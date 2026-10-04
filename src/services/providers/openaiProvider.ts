import { AIProvider, ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';
import { fetchWithRetry, sanitizeMessage } from './withRetry';

export class OpenAIProvider implements AIProvider {
  public id = 'openai' as const;
  public name = 'OpenAI';
  public description = 'Lead Analyst: Analyzes the question, establishes foundational models, and outlines structured solutions.';
  public defaultRoleName = 'Lead Analyst';
  public defaultModel = 'gpt-4o';

  public async listModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey || !apiKey.trim()) return STATIC_FALLBACK_MODELS.openai;
    const cleanKey = apiKey.trim();

    // 1. Try serverless proxy first to avoid CORS
    try {
      const proxyRes = await fetch('/api/provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', apiKey: cleanKey }),
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
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
        },
      });

      if (!response.ok) return STATIC_FALLBACK_MODELS.openai;

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered: ModelInfo[] = rawList
        .filter((m: { id?: string }) => {
          const id = (m.id || '').toLowerCase();
          const isChatPrefix =
            id.startsWith('gpt-') ||
            id.startsWith('o1') ||
            id.startsWith('o3') ||
            id.startsWith('chatgpt');
          const isNonChat =
            id.includes('audio') ||
            id.includes('realtime') ||
            id.includes('instruct') ||
            id.includes('embedding') ||
            id.includes('tts') ||
            id.includes('whisper') ||
            id.includes('dall-e') ||
            id.includes('babbage') ||
            id.includes('davinci');
          return isChatPrefix && !isNonChat;
        })
        .map((m: { id: string }) => ({
          id: m.id,
          label: m.id,
        }));

      return filtered.length > 0 ? filtered : STATIC_FALLBACK_MODELS.openai;
    } catch {
      return STATIC_FALLBACK_MODELS.openai;
    }
  }

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'OpenAI API key is required.' };
    }

    try {
      const models = await this.listModels(apiKey);
      if (models && models.length > 0) {
        return { success: true, models };
      }
      return { success: false, error: 'No active OpenAI models available for this API key.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Network error connecting to OpenAI.';
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

    const targetModel = model || this.defaultModel;

    try {
      const response = await fetchWithRetry(
        'https://api.openai.com/v1/chat/completions',
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
        provider: 'openai',
        model: targetModel,
        content,
        durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Discussion was stopped by user.');
      }
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'OpenAI request failed';
      throw new Error(msg);
    }
  }
}
