import { AIProvider, ProviderRequest, ProviderResponse } from './types';

export class ClaudeProvider implements AIProvider {
  public id = 'claude' as const;
  public name = 'Claude';
  public description = 'Critical Reviewer: Analyzes edge cases, stress-tests arguments, and exposes blind spots in other approaches.';
  public defaultRoleName = 'Critical Reviewer';
  public defaultModel = 'claude-3-7-sonnet-20250219';

  public async validateConnection(apiKey: string, model?: string): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      return { success: false, error: 'API key is required.' };
    }

    try {
      const targetModel = model || this.defaultModel;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Claude authentication failed. Please verify your Anthropic API key.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Claude rate limit or credit quota exceeded.' };
        }
        let errDetail = '';
        try {
          const errData = await response.json();
          errDetail = errData.error?.message || '';
        } catch {
          // ignore
        }
        return { success: false, error: `Claude connection failed (${response.status}): ${errDetail}` };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error connecting to Anthropic Claude.';
      return { success: false, error: msg };
    }
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { apiKey, model, systemPrompt, userPrompt, signal } = request;

    if (!apiKey) {
      throw new Error('Claude API key is missing. Please configure it in Settings.');
    }

    const targetModel = model || this.defaultModel;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
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
          // ignore
        }

        if (response.status === 401) {
          throw new Error('Claude authentication failed. Please verify your Anthropic API key in Settings.');
        }
        if (response.status === 429) {
          throw new Error('Claude rate limit or credit quota exceeded.');
        }
        throw new Error(`Claude error (${response.status}): ${errDetail || response.statusText}`);
      }

      const data = await response.json();
      const content = Array.isArray(data.content)
        ? data.content.map((c: { text?: string }) => c.text || '').join('')
        : '';

      return {
        provider: 'claude',
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
