// Vercel Serverless Function: /api/provider/test
// Tests API key connectivity for OpenAI, Gemini, or Claude.
// SECURITY: API key is used strictly for this request and discarded immediately.
// Never persists to database, disk, or logs.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { provider, apiKey, model } = req.body || {};

  if (!provider || !apiKey) {
    return res.status(400).json({ success: false, error: 'Provider and API key are required' });
  }

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ success: false, error: 'OpenAI authentication failed. Invalid API key.' });
        }
        return res.status(response.status).json({ success: false, error: `OpenAI connection failed (Status ${response.status})` });
      }
      return res.status(200).json({ success: true });
    }

    if (provider === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}?key=${apiKey}`
      );
      if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
          return res.status(401).json({ success: false, error: 'Gemini authentication failed. Invalid API key.' });
        }
        return res.status(response.status).json({ success: false, error: `Gemini connection failed (Status ${response.status})` });
      }
      return res.status(200).json({ success: true });
    }

    if (provider === 'claude') {
      const targetModel = model || 'claude-3-7-sonnet-20250219';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ success: false, error: 'Claude authentication failed. Invalid API key.' });
        }
        return res.status(response.status).json({ success: false, error: `Claude connection failed (Status ${response.status})` });
      }
      return res.status(200).json({ success: true });
    }

    if (provider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ success: false, error: 'Groq authentication failed. Invalid API key.' });
        }
        return res.status(response.status).json({ success: false, error: `Groq connection failed (Status ${response.status})` });
      }
      return res.status(200).json({ success: true });
    }

    if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ success: false, error: 'DeepSeek authentication failed. Invalid API key.' });
        }
        return res.status(response.status).json({ success: false, error: `DeepSeek connection failed (Status ${response.status})` });
      }
      return res.status(200).json({ success: true });
    }

    if (provider === 'mock') {
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return res.status(500).json({ success: false, error: message });
  }
}
