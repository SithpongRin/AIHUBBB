import { AIProvider, ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';
import { fetchWithRetry, sanitizeMessage } from './withRetry';

export class DeepSeekProvider implements AIProvider {
  public id = 'deepseek' as const;
  public name = 'DeepSeek';
  public description = 'Deep Reasoning & Code: Next-generation reasoning with DeepSeek-R1 and DeepSeek-V3.';
  public defaultRoleName = 'Deep Reasoning Specialist';
  public defaultModel = 'deepseek-chat';

  public async listModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey || !apiKey.trim()) return STATIC_FALLBACK_MODELS.deepseek;
    const cleanKey = apiKey.trim();

    // 1. Try serverless proxy first to avoid CORS
    try {
      const proxyRes = await fetch('/api/provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'deepseek', apiKey: cleanKey }),
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
      const response = await fetch('https://api.deepseek.com/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
        },
      });

      if (!response.ok) return STATIC_FALLBACK_MODELS.deepseek;

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered: ModelInfo[] = rawList.map((m: { id: string }) => ({
        id: m.id,
        label: m.id,
      }));

      return filtered.length > 0 ? filtered : STATIC_FALLBACK_MODELS.deepseek;
    } catch {
      return STATIC_FALLBACK_MODELS.deepseek;
    }
  }

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'DeepSeek API key is required.' };
    }

    try {
      const models = await this.listModels(apiKey);
      if (models && models.length > 0) {
        return { success: true, models };
      }
      return { success: false, error: 'No active DeepSeek models available for this API key.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Network error connecting to DeepSeek.';
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
      const response = await fetchWithRetry(
        'https://api.deepseek.com/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: 0.7,
          }),
        },
        { signal }
      );

      const durationMs = Date.now() - startTime;
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        provider: 'deepseek',
        model: targetModel,
        content: content.trim(),
        durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('DeepSeek request was cancelled.');
      }
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'DeepSeek request failed';
      throw new Error(msg);
    }
  }
}
