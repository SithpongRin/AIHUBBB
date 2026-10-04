// Vercel Serverless Function: /api/discussion/round
// Executes a discussion round step for a given provider.
// API key is never persisted or logged.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { provider, model, apiKey, systemPrompt, userPrompt } = req.body || {};

  if (!provider || !apiKey || !userPrompt) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  const startTime = Date.now();

  try {
    let content = '';

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt || '' },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || `OpenAI request failed (${response.status})`,
        });
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        }),
      });

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: `Gemini request failed (${response.status})`,
        });
      }

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    } else if (provider === 'claude') {
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
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          success: false,
          error: errorData.error?.message || `Claude request failed (${response.status})`,
        });
      }

      const data = await response.json();
      content = Array.isArray(data.content)
        ? data.content.map((c: any) => c.text || '').join('')
        : '';
    } else {
      return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
    }

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      provider,
      model,
      content,
      durationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal execution error';
    return res.status(500).json({ success: false, error: message });
  }
}
