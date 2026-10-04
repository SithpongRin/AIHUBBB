import { AIProvider, ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';
import { fetchWithRetry, sanitizeMessage } from './withRetry';

export class ClaudeProvider implements AIProvider {
  public id = 'claude' as const;
  public name = 'Claude';
  public description = 'Critical Reviewer: Analyzes edge cases, stress-tests arguments, and exposes blind spots in other approaches.';
  public defaultRoleName = 'Critical Reviewer';
  public defaultModel = 'claude-3-7-sonnet-20250219';

  public async listModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey || !apiKey.trim()) return STATIC_FALLBACK_MODELS.claude;
    const cleanKey = apiKey.trim();

    // 1. Try serverless proxy first to avoid CORS
    try {
      const proxyRes = await fetch('/api/provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'claude', apiKey: cleanKey }),
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
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });

      if (!response.ok) return STATIC_FALLBACK_MODELS.claude;

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered: ModelInfo[] = rawList.map((m: { id: string; display_name?: string }) => ({
        id: m.id,
        label: m.display_name || m.id,
      }));

      return filtered.length > 0 ? filtered : STATIC_FALLBACK_MODELS.claude;
    } catch {
      return STATIC_FALLBACK_MODELS.claude;
    }
  }

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'API key is required.' };
    }

    try {
      const models = await this.listModels(apiKey);
      if (models && models.length > 0) {
        return { success: true, models };
      }
      return { success: false, error: 'No active Claude models available for this API key.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Network error connecting to Claude.';
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
      const response = await fetchWithRetry(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
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
        },
        { signal }
      );

      const durationMs = Date.now() - startTime;
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
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Claude request failed';
      throw new Error(msg);
    }
  }
}
