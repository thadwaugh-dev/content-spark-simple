/**
 * Shared CORS and request helpers for the Pro API routes.
 * Production origins match the allowlist from the github.io / contentspark.fyi fix:
 * github.io, contentspark.fyi, and www.contentspark.fyi.
 */

const ALLOW_ORIGINS = [
  'https://thadwaugh-dev.github.io',
  'https://contentspark.fyi',
  'https://www.contentspark.fyi',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
];

function allowOrigin(origin) {
  return ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
}

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin(origin));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

function readJsonBody(req) {
  const body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function clientIp(req) {
  const headers = req.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const first = String(forwarded).split(',')[0].trim();
  if (first) return first.slice(0, 64);
  const raw = req.socket && req.socket.remoteAddress;
  return raw ? String(raw).slice(0, 64) : 'unknown';
}

module.exports = {
  ALLOW_ORIGINS,
  allowOrigin,
  applyCors,
  readJsonBody,
  clientIp,
};
