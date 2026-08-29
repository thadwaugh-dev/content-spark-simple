/**
 * ContentSpark Pro generate — Vercel serverless function.
 * Secrets: XAI_API_KEY (preferred) or GROQ_API_KEY.
 * Never log full prompts or topics.
 */

const ALLOW_ORIGINS = [
  'https://thadwaugh-dev.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
];

const SYSTEM_PROMPT = [
  'You write useful social copy. No fluff. No preamble.',
  'Return ONLY valid JSON with keys: captions, threads, hashtags, hooks.',
  'captions: 10 strings. No hashtags inside captions.',
  'threads: 5 strings. Each is one short thread idea written as 5 short posts separated by newlines (1/5 ... 5/5).',
  'hashtags: 12 to 18 strings, each starting with #.',
  'hooks: 6 strings. First-line video openers only.',
  'Do not mention that you are an AI.',
].join(' ');

function allowOrigin(origin) {
  return ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin(origin));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

function stripFence(text) {
  const trimmed = String(text || '').trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : trimmed;
}

function asStringArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && (v.title || v.text)) return String(v.title || v.text);
      return '';
    })
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

async function chatComplete(topic) {
  const xai = process.env.XAI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  if (!xai && !groq) {
    const err = new Error('missing_key');
    err.status = 503;
    throw err;
  }

  const payload = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Topic or niche:\n${topic}` },
    ],
    temperature: 0.7,
  };

  let url;
  let headers;
  let models;
  if (xai) {
    url = 'https://api.x.ai/v1/chat/completions';
    headers = { Authorization: `Bearer ${xai}`, 'Content-Type': 'application/json' };
    models = ['grok-4', 'grok-4.3', 'grok-4-fast-non-reasoning'];
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { Authorization: `Bearer ${groq}`, 'Content-Type': 'application/json' };
    models = ['llama-3.1-8b-instant'];
  }

  let res;
  let lastStatus = 502;
  for (const model of models) {
    payload.model = model;
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) break;
    lastStatus = res.status;
    res = null;
  }

  if (!res) {
    const err = new Error('upstream');
    err.status = lastStatus >= 500 ? 503 : 502;
    throw err;
  }

  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const parsed = JSON.parse(stripFence(text));
  return {
    captions: asStringArray(parsed.captions, 10),
    threads: asStringArray(parsed.threads, 5),
    hashtags: asStringArray(parsed.hashtags, 18),
    hooks: asStringArray(parsed.hooks, 6),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  try {
    const out = await chatComplete(topic);
    if (!out.captions.length || !out.threads.length || !out.hooks.length) {
      res.status(502).json({ error: 'Model returned empty copy' });
      return;
    }
    res.status(200).json(out);
  } catch (err) {
    const status = err && err.status ? err.status : 503;
    const reason = status === 401 || status === 403
      ? 'unauthorized'
      : status === 404
        ? 'model'
        : 'upstream';
    res.status(status >= 400 && status < 600 ? (status >= 500 ? 503 : 502) : 503).json({
      error: 'AI unavailable',
      reason,
    });
  }
};
