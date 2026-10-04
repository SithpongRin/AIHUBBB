import { AIProvider, ProviderRequest, ProviderResponse } from './types';

export class GeminiProvider implements AIProvider {
  public id = 'gemini' as const;
  public name = 'Gemini';
  public description = 'Alternative Analyst: Explores alternative paradigms, challenges assumptions, and identifies missing vectors.';
  public defaultRoleName = 'Alternative Analyst';
  public defaultModel = 'gemini-2.5-flash';

  public async validateConnection(apiKey: string, model?: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      return { success: false, error: 'API key is required.' };
    }

    try {
      const targetModel = model || this.defaultModel;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}?key=${apiKey}`;
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
          return { success: false, error: 'Gemini authentication failed. Please verify your API key.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Gemini rate limit or quota exceeded.' };
        }
        return { success: false, error: `Gemini connection failed (Status ${response.status}).` };
      }

      return { success: true };
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

    const targetModel = model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal,
      });

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
          throw new Error('Gemini authentication failed. Please check your API key in Settings.');
        }
        if (response.status === 429) {
          throw new Error('Gemini quota or rate limit exceeded.');
        }
        throw new Error(`Gemini error (${response.status}): ${errDetail || response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

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
