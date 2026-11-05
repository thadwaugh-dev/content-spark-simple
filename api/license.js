/**
 * Validate or release a ContentSpark Pro license key.
 * POST { license_key, instance_id } activates (once) or re-validates.
 * POST { action: "deactivate", license_key, instance_id } frees that device.
 * Uses Lemon Squeezy's public License API. No Lemon Squeezy API key.
 */

const { applyCors, readJsonBody, clientIp } = require('../lib/pro-http');
const { createLicenseGate } = require('../lib/pro-license');

function send(res, status, body, extraHeaders) {
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach((key) => {
      res.setHeader(key, extraHeaders[key]);
    });
  }
  res.status(status).json(body);
}

function createLicenseHandler(options = {}) {
  const gate = options.gate || createLicenseGate({
    fetch: options.fetch,
    now: options.now,
    limits: options.limits,
    cacheMs: options.cacheMs,
    productIds: options.productIds,
    storeIds: options.storeIds,
  });

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
    const action = body.action === 'deactivate' ? 'deactivate' : 'activate';
    let decision;
    try {
      decision = await gate.check({
        action,
        licenseKey: body.license_key,
        instanceId: body.instance_id,
        ip: clientIp(req),
      });
    } catch {
      send(res, 503, {
        ok: false,
        error: 'License check is unavailable. Try again in a minute.',
        code: 'license_unavailable',
      });
      return;
    }

    if (!decision.ok) {
      const headers = decision.retryAfterMs
        ? { 'Retry-After': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) }
        : null;
      send(res, decision.status, { ok: false, error: decision.error, code: decision.code }, headers);
      return;
    }

    const payload = { ok: true };
    if (decision.instanceId) payload.instance_id = decision.instanceId;
    send(res, 200, payload);
  };
}

const handler = createLicenseHandler();
module.exports = handler;
module.exports.createLicenseHandler = createLicenseHandler;
