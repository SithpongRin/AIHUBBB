import { AIProvider, ProviderRequest, ProviderResponse } from './types';

export class DeepSeekProvider implements AIProvider {
  public id = 'deepseek' as const;
  public name = 'DeepSeek';
  public description = 'Deep Reasoning & Code: Next-generation reasoning with DeepSeek-R1 and DeepSeek-V3.';
  public defaultRoleName = 'Deep Reasoning Specialist';
  public defaultModel = 'deepseek-chat';

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key is required.' };
    }

    try {
      const response = await fetch('https://api.deepseek.com/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'DeepSeek authentication failed. Please verify your API key.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'DeepSeek balance insufficient or rate limit exceeded.' };
        }
        return { success: false, error: `DeepSeek connection failed (Status ${response.status}).` };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to DeepSeek.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('DeepSeek API key is missing. Please configure it in Settings.');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const targetModel = model || this.defaultModel;

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.7,
        }),
        signal,
      });

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
        throw new Error(`DeepSeek API error: ${errDetails}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        provider: 'deepseek',
        model: targetModel,
        content: content.trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('DeepSeek request was cancelled.');
      }
      const msg = err instanceof Error ? err.message : 'DeepSeek request failed';
      throw new Error(msg);
    }
  }
}
