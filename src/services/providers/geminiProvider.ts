import { AIProvider, ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';
import { fetchWithRetry, sanitizeMessage } from './withRetry';

export class GeminiProvider implements AIProvider {
  public id = 'gemini' as const;
  public name = 'Gemini';
  public description = 'Alternative Analyst: Explores alternative paradigms, challenges assumptions, and identifies missing vectors.';
  public defaultRoleName = 'Alternative Analyst';
  public defaultModel = 'gemini-2.5-flash';

  /**
   * Dynamically fetch all available models supported by this Gemini API key.
   */
  public async listModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey || !apiKey.trim()) return STATIC_FALLBACK_MODELS.gemini;
    const cleanKey = apiKey.trim();

    // 1. Try serverless proxy first to avoid CORS
    try {
      const proxyRes = await fetch('/api/provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gemini', apiKey: cleanKey }),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models;
        }
      }
    } catch {
      // Serverless proxy unavailable, fallback to direct fetch
    }

    // 2. Direct client fetch fallback
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
      const response = await fetch(url);
      if (!response.ok) return STATIC_FALLBACK_MODELS.gemini;

      const data = await response.json();
      if (Array.isArray(data.models)) {
        const filtered = data.models
          .filter((m: { supportedGenerationMethods?: string[]; name?: string }) => {
            const hasGen = m.supportedGenerationMethods?.includes('generateContent');
            const n = (m.name || '').toLowerCase();
            return hasGen && !n.includes('embedding') && !n.includes('aqa') && !n.includes('imagen');
          })
          .map((m: { name: string; displayName?: string }) => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: cleanId,
              label: m.displayName || cleanId,
            };
          });

        return filtered.length > 0 ? filtered : STATIC_FALLBACK_MODELS.gemini;
      }
      return STATIC_FALLBACK_MODELS.gemini;
    } catch {
      return STATIC_FALLBACK_MODELS.gemini;
    }
  }

  // Alias for backward compatibility
  public async fetchAvailableModels(apiKey: string): Promise<{ id: string; name: string; description: string }[]> {
    const list = await this.listModels(apiKey);
    return list.map((m) => ({
      id: m.id,
      name: m.label || m.id,
      description: 'Google Gemini model',
    }));
  }

  public async validateConnection(
    apiKey: string,
    _model?: string
  ): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'Gemini API key is required.' };
    }

    try {
      const models = await this.listModels(apiKey);
      if (models && models.length > 0) {
        return { success: true, models };
      }
      return { success: false, error: 'No active Gemini models available for this API key.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Network error connecting to Gemini.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please configure it in Settings.');
    }

    const cleanModel = (model || this.defaultModel).replace(/^models\//, '');

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

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;
      const response = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        },
        { signal }
      );

      const durationMs = Date.now() - startTime;
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

      if (!content) {
        throw new Error('Gemini returned an empty response. Please retry.');
      }

      return {
        provider: 'gemini',
        model: cleanModel,
        content,
        durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Discussion was stopped by user.');
      }
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Gemini request failed';
      throw new Error(msg);
    }
  }
}
