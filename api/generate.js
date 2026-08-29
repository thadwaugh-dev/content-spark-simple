/**
 * ContentSpark Pro generate Worker.
 * Secrets: XAI_API_KEY (preferred) or GROQ_API_KEY.
 * Never log full prompts or topics.
 */

const ALLOW_ORIGINS = [
  'https://thadwaugh-dev.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',
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

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
    },
  });
}

function stripFence(text) {
  const trimmed = String(text || '').trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : trimmed;
}

function asStringArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v : (v && (v.title || v.text)) ? String(v.title || v.text) : ''))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

async function chatComplete(env, userTopic) {
  const xai = env.XAI_API_KEY;
  const groq = env.GROQ_API_KEY;
  if (!xai && !groq) {
    const err = new Error('missing_key');
    err.code = 503;
    throw err;
  }

  const payload = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Topic or niche:\n${userTopic}` },
    ],
    temperature: 0.7,
  };

  let url;
  let headers;
  if (xai) {
    url = 'https://api.x.ai/v1/chat/completions';
    headers = { Authorization: `Bearer ${xai}`, 'Content-Type': 'application/json' };
    payload.model = 'grok-4';
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { Authorization: `Bearer ${groq}`, 'Content-Type': 'application/json' };
    payload.model = 'llama-3.1-8b-instant';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = new Error('upstream');
    err.code = res.status >= 500 ? 503 : 502;
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const isGenerate = path === '/api/generate' || path === '/generate' || path === '/';

    if (request.method !== 'POST' || !isGenerate) {
      return json(request, { error: 'Not found' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: 'Invalid JSON' }, 400);
    }

    const topic = body && typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic) {
      return json(request, { error: 'topic is required' }, 400);
    }

    try {
      const out = await chatComplete(env, topic);
      if (!out.captions.length || !out.threads.length || !out.hooks.length) {
        return json(request, { error: 'Model returned empty copy' }, 502);
      }
      return json(request, out, 200);
    } catch (err) {
      const status = err && err.code ? err.code : 503;
      if (err && err.message === 'missing_key') {
        return json(request, { error: 'AI unavailable' }, 503);
      }
      return json(request, { error: 'AI unavailable' }, status);
    }
  },
};
