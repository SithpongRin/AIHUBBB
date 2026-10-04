// Vercel Serverless Function: /api/provider/models
// Dynamically fetches available models for Groq, Gemini, OpenAI, Claude, DeepSeek, or Mock.
// SECURITY: API key is passed per request and NEVER logged or stored.

interface ModelInfo {
  id: string;
  label?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { provider, apiKey } = req.body || {};

  if (!provider) {
    return res.status(400).json({ success: false, error: 'Provider is required' });
  }

  if (provider === 'mock') {
    return res.status(200).json({
      success: true,
      models: [
        { id: 'mock-fast', label: 'Mock Fast 1.0 (Simulation)' },
        { id: 'mock-analyst', label: 'Mock Lead Analyst (Simulation)' },
        { id: 'mock-critic', label: 'Mock Critical Reviewer (Simulation)' },
      ],
    });
  }

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ success: false, error: 'API key is required' });
  }

  const cleanKey = apiKey.trim();

  try {
    if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          return res.status(401).json({ success: false, error: 'Groq authentication failed. Please check your API key.' });
        }
        return res.status(status).json({ success: false, error: `Groq error (Status ${status})` });
      }

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      // Filter out non-chat models (whisper, tts, guard, embed, etc.)
      const filtered: ModelInfo[] = rawList
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

      return res.status(200).json({ success: true, models: filtered });
    }

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        const status = response.status;
        if (status === 400 || status === 403) {
          return res.status(401).json({ success: false, error: 'Gemini authentication failed. Please check your API key.' });
        }
        return res.status(status).json({ success: false, error: `Gemini error (Status ${status})` });
      }

      const data = await response.json();
      const rawList = Array.isArray(data.models) ? data.models : [];

      // Keep only models whose supportedGenerationMethods include "generateContent"
      // Strip "models/" prefix
      const filtered: ModelInfo[] = rawList
        .filter((m: { name?: string; supportedGenerationMethods?: string[] }) => {
          const hasGen = m.supportedGenerationMethods?.includes('generateContent');
          const name = (m.name || '').toLowerCase();
          return (
            hasGen &&
            !name.includes('embedding') &&
            !name.includes('aqa') &&
            !name.includes('imagen')
          );
        })
        .map((m: { name: string; displayName?: string }) => {
          const cleanId = m.name.replace(/^models\//, '');
          return {
            id: cleanId,
            label: m.displayName || cleanId,
          };
        });

      return res.status(200).json({ success: true, models: filtered });
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          return res.status(401).json({ success: false, error: 'OpenAI authentication failed. Please check your API key.' });
        }
        return res.status(status).json({ success: false, error: `OpenAI error (Status ${status})` });
      }

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      // Keep only chat-capable models
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

      return res.status(200).json({ success: true, models: filtered });
    }

    if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          return res.status(401).json({ success: false, error: 'Claude authentication failed. Please check your API key.' });
        }
        return res.status(status).json({ success: false, error: `Claude error (Status ${status})` });
      }

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered: ModelInfo[] = rawList.map((m: { id: string; display_name?: string }) => ({
        id: m.id,
        label: m.display_name || m.id,
      }));

      return res.status(200).json({ success: true, models: filtered });
    }

    if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          return res.status(401).json({ success: false, error: 'DeepSeek authentication failed. Please check your API key.' });
        }
        return res.status(status).json({ success: false, error: `DeepSeek error (Status ${status})` });
      }

      const data = await response.json();
      const rawList = Array.isArray(data.data) ? data.data : [];

      const filtered: ModelInfo[] = rawList.map((m: { id: string }) => ({
        id: m.id,
        label: m.id,
      }));

      return res.status(200).json({ success: true, models: filtered });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve models from provider';
    return res.status(500).json({ success: false, error: msg });
  }
}
