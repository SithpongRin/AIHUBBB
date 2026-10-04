import { AIProvider, ProviderRequest, ProviderResponse } from './types';
import { providerKeyStore } from './keyStore';

export class GeminiProvider implements AIProvider {
  public id = 'gemini' as const;
  public name = 'Gemini';
  public description = 'Alternative Analyst: Explores alternative paradigms, challenges assumptions, and identifies missing vectors.';
  public defaultRoleName = 'Alternative Analyst';
  public defaultModel = 'gemini-3.8-flash';

  /**
   * Dynamically fetch all available models supported by this specific Gemini API key!
   */
  public async fetchAvailableModels(apiKey: string): Promise<{ id: string; name: string; description: string }[]> {
    if (!apiKey) return [];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      if (Array.isArray(data.models)) {
        return data.models
          .filter((m: { supportedGenerationMethods?: string[]; name?: string }) => {
            const hasGen = m.supportedGenerationMethods?.includes('generateContent');
            const n = m.name?.toLowerCase() || '';
            return hasGen && !n.includes('embedding') && !n.includes('aqa') && !n.includes('imagen');
          })
          .map((m: { name: string; displayName?: string; description?: string }) => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: cleanId,
              name: m.displayName || cleanId,
              description: m.description || 'Google Gemini model',
            };
          });
      }
      return [];
    } catch {
      return [];
    }
  }

  public async validateConnection(
    apiKey: string,
    model?: string
  ): Promise<{ success: boolean; error?: string; models?: { id: string; name: string; description: string }[] }> {
    if (!apiKey) {
      return { success: false, error: 'API key is required.' };
    }

    try {
      // Query models directly from the API key to ensure the key is valid and retrieve all supported models
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        let errDetail = '';
        try {
          const errData = await response.json();
          errDetail = errData.error?.message || '';
        } catch {
          // ignore
        }
        if (response.status === 400 || response.status === 403) {
          return { success: false, error: `Gemini authentication failed: ${errDetail || 'Invalid API key'}` };
        }
        if (response.status === 429) {
          return { success: false, error: 'Gemini rate limit or quota exceeded.' };
        }
        return { success: false, error: `Gemini connection failed (Status ${response.status}): ${errDetail}` };
      }

      const data = await response.json();
      const fetchedModels: { id: string; name: string; description: string }[] = [];

      if (Array.isArray(data.models)) {
        data.models
          .filter((m: { supportedGenerationMethods?: string[]; name?: string }) => {
            const hasGen = m.supportedGenerationMethods?.includes('generateContent');
            const n = m.name?.toLowerCase() || '';
            return hasGen && !n.includes('embedding') && !n.includes('aqa') && !n.includes('imagen');
          })
          .forEach((m: { name: string; displayName?: string; description?: string }) => {
            const cleanId = m.name.replace(/^models\//, '');
            fetchedModels.push({
              id: cleanId,
              name: m.displayName || cleanId,
              description: m.description || 'Google Gemini model',
            });
          });
      }

      // If user selected model was deprecated or not in list, auto-select the best available model
      const currentSelected = (model || '').replace(/^models\//, '');
      const hasSelected = fetchedModels.some((m) => m.id === currentSelected);
      if (!hasSelected && fetchedModels.length > 0) {
        const best =
          fetchedModels.find((m) => m.id.includes('3.8')) ||
          fetchedModels.find((m) => m.id.includes('flash')) ||
          fetchedModels[0];
        if (best) {
          providerKeyStore.setModel('gemini', best.id);
        }
      }

      return {
        success: true,
        models: fetchedModels,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to Gemini.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please configure it in Settings.');
    }

    let targetModel = (model || this.defaultModel).replace(/^models\//, '');
    // Automatically migrate deprecated model names
    if (targetModel.includes('2.0') || !targetModel) {
      targetModel = 'gemini-3.8-flash';
    }

    const bodyPayload: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    };

    if (systemPrompt && systemPrompt.trim()) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }],
      };
    }

    const sendRequest = async (modelToUse: string): Promise<Response> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey.trim()}`;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });
    };

    try {
      let response = await sendRequest(targetModel);

      // If 404 occurs (e.g. model deprecated or not available in this key's region),
      // dynamically fetch the models available to this API key and retry with a working model!
      if (response.status === 404) {
        const available = await this.fetchAvailableModels(apiKey);
        if (available.length > 0) {
          const fallback =
            available.find((m) => m.id.includes('3.8')) ||
            available.find((m) => m.id.includes('flash')) ||
            available[0];

          if (fallback && fallback.id !== targetModel) {
            targetModel = fallback.id;
            providerKeyStore.setModel('gemini', targetModel);
            response = await sendRequest(targetModel);
          }
        }
      }

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errDetail = '';
        try {
          const errData = await response.json();
          errDetail = errData.error?.message || '';
        } catch {
          // ignore
        }

        if (response.status === 400 || response.status === 403) {
          throw new Error(`Gemini request failed (${response.status}): ${errDetail || 'Invalid API key or model name'}`);
        }
        if (response.status === 404) {
          throw new Error(`Gemini model ${targetModel} is not available for your API key. Please check Settings.`);
        }
        if (response.status === 429) {
          throw new Error('Gemini quota or rate limit exceeded.');
        }
        throw new Error(`Gemini error (${response.status}): ${errDetail || response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

      if (!content) {
        throw new Error('Gemini returned an empty response. Please retry.');
      }

      return {
        provider: 'gemini',
        model: targetModel,
        content,
        durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Discussion was stopped by user.');
      }
      throw err;
    }
  }
}

