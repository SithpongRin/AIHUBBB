import { AIProvider, ProviderRequest, ProviderResponse } from './types';

export class OpenAIProvider implements AIProvider {
  public id = 'openai' as const;
  public name = 'OpenAI';
  public description = 'Lead Analyst: Analyzes the question, establishes foundational models, and outlines structured solutions.';
  public defaultRoleName = 'Lead Analyst';
  public defaultModel = 'gpt-4o';

  public async validateConnection(apiKey: string, model?: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      return { success: false, error: 'API key is required.' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'OpenAI authentication failed. Please verify your API key.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'OpenAI rate limit or credit quota exceeded.' };
        }
        return { success: false, error: `OpenAI connection failed (Status ${response.status}).` };
      }

      const data = await response.json();
      if (model && Array.isArray(data.data)) {
        const found = data.data.some((m: { id: string }) => m.id === model);
        if (!found) {
          // Model might still be valid or restricted, but key itself is valid
          return { success: true };
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to OpenAI.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('OpenAI API key is missing. Please configure it in Settings.');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || this.defaultModel,
          messages,
          temperature: 0.7,
        }),
        signal,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errDetail = '';
        try {
          const errData = await response.json();
          errDetail = errData.error?.message || '';
        } catch {
          // ignore parsing error
        }

        if (response.status === 401) {
          throw new Error('OpenAI authentication failed. Please verify your API key in Settings.');
        }
        if (response.status === 429) {
          throw new Error(`OpenAI rate limit or credit quota exceeded. ${errDetail}`.trim());
        }
        throw new Error(`OpenAI error (${response.status}): ${errDetail || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        provider: 'openai',
        model: model || this.defaultModel,
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
