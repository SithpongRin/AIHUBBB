import { AIProvider, ProviderRequest, ProviderResponse } from './types';

export class GroqProvider implements AIProvider {
  public id = 'groq' as const;
  public name = 'Groq';
  public description = 'Ultra-Fast Inference: Blazing fast responses using Llama 3.3 70B & Llama 3.1 on LPUs.';
  public defaultRoleName = 'Fast Synthesizer';
  public defaultModel = 'llama-3.3-70b-versatile';

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      return { success: false, error: 'Groq API key is required.' };
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Groq authentication failed. Please verify your API key.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Groq rate limit exceeded.' };
        }
        return { success: false, error: `Groq connection failed (Status ${response.status}).` };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to Groq.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('Groq API key is missing. Please configure it in Settings.');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let targetModel = model || this.defaultModel;
    if (targetModel.includes('3.1-8b')) {
      targetModel = 'llama-3.3-70b-versatile';
    }

    try {
      const sendReq = async (m: string) => {
        return fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: m,
            messages,
            temperature: 0.7,
          }),
          signal,
        });
      };

      let response = await sendReq(targetModel);

      // If model not found or invalid on this account, retry with flagship llama-3.3-70b-versatile
      if (!response.ok && (response.status === 400 || response.status === 404)) {
        if (targetModel !== 'llama-3.3-70b-versatile') {
          targetModel = 'llama-3.3-70b-versatile';
          response = await sendReq(targetModel);
        }
      }

      if (!response.ok) {
        let errDetails = `Status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            errDetails = errData.error.message;
          }
        } catch {
          // ignore
        }
        throw new Error(`Groq API error: ${errDetails}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        provider: 'groq',
        model: targetModel,
        content: content.trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Groq request was cancelled.');
      }
      const msg = err instanceof Error ? err.message : 'Groq request failed';
      throw new Error(msg);
    }
  }
}
