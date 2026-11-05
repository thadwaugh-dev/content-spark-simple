/**
 * ContentSpark Pro generate — Vercel serverless function.
 * Requires a Lemon Squeezy license for product 1325795 (override with
 * LEMONSQUEEZY_PRODUCT_ID). No Lemon Squeezy API key.
 * Secrets: XAI_API_KEY (preferred) or GROQ_API_KEY.
 * Never log full prompts, topics, or license keys.
 */

const { applyCors, readJsonBody, clientIp } = require('../lib/pro-http');
const { createLicenseGate } = require('../lib/pro-license');

const SYSTEM_PROMPT = [
  'You write useful social copy. No fluff. No preamble.',
  'Return ONLY valid JSON with keys: captions, threads, hashtags, hooks.',
  'captions: 10 strings. No hashtags inside captions.',
  'threads: 5 strings. Each is one short thread idea written as 5 short posts separated by newlines (1/5 ... 5/5).',
  'hashtags: 12 to 18 strings, each starting with #.',
  'hooks: 6 strings. First-line video openers only.',
  'Do not mention that you are an AI.',
].join(' ');

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

async function chatComplete(topic, deps) {
  const env = (deps && deps.env) || process.env;
  const fetchImpl = (deps && deps.fetch) || fetch;
  const xai = env.XAI_API_KEY;
  const groq = env.GROQ_API_KEY;
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
  };

  let url;
  let headers;
  let models;
  if (xai) {
    url = 'https://api.x.ai/v1/chat/completions';
    headers = { Authorization: `Bearer ${xai}`, 'Content-Type': 'application/json' };
    models = ['grok-4.6', 'grok-4.3', 'grok-4.5'];
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { Authorization: `Bearer ${groq}`, 'Content-Type': 'application/json' };
    models = ['llama-3.1-8b-instant'];
  }

  let res;
  let lastStatus = 502;
  let lastDetail = '';
  for (const model of models) {
    payload.model = model;
    res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) break;
    lastStatus = res.status;
    try {
      const errBody = await res.json();
      const msg = errBody && errBody.error && (errBody.error.message || errBody.error);
      lastDetail = String(msg || '').slice(0, 160);
    } catch {
      lastDetail = '';
    }
    res = null;
  }

  if (!res) {
    const err = new Error('upstream');
    err.upstream = lastStatus;
    err.detail = lastDetail;
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

function send(res, status, body, extraHeaders) {
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach((key) => {
      res.setHeader(key, extraHeaders[key]);
    });
  }
  res.status(status).json(body);
}

function createGenerateHandler(options = {}) {
  const fetchImpl = options.fetch;
  const gate = options.gate || createLicenseGate({ fetch: fetchImpl, now: options.now, limits: options.limits, cacheMs: options.cacheMs, productIds: options.productIds, storeIds: options.storeIds });

  return async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const body = readJsonBody(req);
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic) {
      send(res, 400, { error: 'topic is required' });
      return;
    }

    let decision;
    try {
      decision = await gate.check({
        action: 'generate',
        licenseKey: body.license_key,
        instanceId: body.instance_id,
        ip: clientIp(req),
      });
    } catch {
      send(res, 503, {
        error: 'License check is unavailable. Try again in a minute.',
        code: 'license_unavailable',
      });
      return;
    }

    if (!decision.ok) {
      const headers = decision.retryAfterMs
        ? { 'Retry-After': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) }
        : null;
      send(res, decision.status, { error: decision.error, code: decision.code }, headers);
      return;
    }

    try {
      const out = await chatComplete(topic, { fetch: fetchImpl, env: options.env });
      if (!out.captions.length || !out.threads.length || !out.hooks.length) {
        send(res, 502, { error: 'Model returned empty copy' });
        return;
      }
      const payload = {
        captions: out.captions,
        threads: out.threads,
        hashtags: out.hashtags,
        hooks: out.hooks,
      };
      if (decision.instanceId) payload.instance_id = decision.instanceId;
      send(res, 200, payload);
    } catch (err) {
      const status = err && err.status ? err.status : 503;
      const upstream = err && err.upstream ? err.upstream : status;
      const reason = upstream === 401 || upstream === 403
        ? 'unauthorized'
        : upstream === 404
          ? 'model'
          : 'upstream';
      send(res, status, {
        error: 'AI unavailable',
        reason,
        upstream,
        detail: err && err.detail ? String(err.detail).slice(0, 160) : '',
      });
    }
  };
}

const handler = createGenerateHandler();
module.exports = handler;
module.exports.createGenerateHandler = createGenerateHandler;
