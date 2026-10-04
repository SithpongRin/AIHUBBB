import { AIProvider, ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';
import { fetchWithRetry, sanitizeMessage } from './withRetry';

export class GroqProvider implements AIProvider {
  public id = 'groq' as const;
  public name = 'Groq';
  public description = 'Ultra-Fast Inference: Blazing fast responses using Llama 3.3 70B & Llama 3.1 on LPUs.';
  public defaultRoleName = 'Fast Synthesizer';
  public defaultModel = 'llama-3.3-70b-versatile';

  public async listModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey || !apiKey.trim()) return STATIC_FALLBACK_MODELS.groq;
    const cleanKey = apiKey.trim();

    // 1. Try serverless proxy first to avoid CORS
    try {
      const proxyRes = await fetch('/api/provider/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'groq', apiKey: cleanKey }),
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
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
        },
      });

      if (!response.ok) {
        return STATIC_FALLBACK_MODELS.groq;
      }

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered = rawList
        .filter((m: { id?: string }) => {
          const id = (m.id || '').toLowerCase();
          return (
            !id.includes('whisper') &&
            !id.includes('tts') &&
            !id.includes('guard') &&
            !id.includes('embed') &&
            !id.includes('distil-whisper')
          );
        })
        .map((m: { id: string }) => ({
          id: m.id,
          label: m.id,
        }));

      return filtered.length > 0 ? filtered : STATIC_FALLBACK_MODELS.groq;
    } catch {
      return STATIC_FALLBACK_MODELS.groq;
    }
  }

  public async validateConnection(apiKey: string): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'Groq API key is required.' };
    }

    try {
      const models = await this.listModels(apiKey);
      if (models && models.length > 0) {
        return { success: true, models };
      }
      return { success: false, error: 'No active Groq models available for this API key.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Network error connecting to Groq.';
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

    const targetModel = model || this.defaultModel;

    try {
      const response = await fetchWithRetry(
        'https://api.groq.com/openai/v1/chat/completions',
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

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content && content !== '') {
        throw new Error('Groq returned an empty response.');
      }

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
      const msg = err instanceof Error ? sanitizeMessage(err.message) : 'Groq request failed';
      throw new Error(msg);
    }
  }
}
