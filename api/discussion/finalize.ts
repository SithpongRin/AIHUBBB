// Vercel Serverless Function: /api/discussion/finalize
// Synthesizes the multi-round discussion into the structured final answer.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { moderator, model, apiKey, systemPrompt, userPrompt } = req.body || {};

  if (!moderator || !apiKey || !userPrompt) {
    return res.status(400).json({ success: false, error: 'Missing moderator or prompt parameters' });
  }

  const startTime = Date.now();

  try {
    let content = '';

    if (moderator === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Moderator synthesis failed (${response.status})` });
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    } else if (moderator === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        }),
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Moderator synthesis failed (${response.status})` });
      }

      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    } else if (moderator === 'claude') {
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
        return res.status(response.status).json({ success: false, error: `Moderator synthesis failed (${response.status})` });
      }

      const data = await response.json();
      content = Array.isArray(data.content)
        ? data.content.map((c: any) => c.text || '').join('')
        : '';
    } else {
      return res.status(400).json({ success: false, error: `Unsupported moderator: ${moderator}` });
    }

    const durationMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      moderator,
      content,
      durationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal synthesis error';
    return res.status(500).json({ success: false, error: message });
  }
}
