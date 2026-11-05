const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ALLOW_ORIGINS, allowOrigin } = require('../lib/pro-http');
const { createLicenseGate, MESSAGES } = require('../lib/pro-license');
const { createGenerateHandler } = require('../api/generate');
const { createLicenseHandler } = require('../api/license');

const KEY = '11111111-2222-4333-8444-555555555555';
const INSTANCE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ROOT = path.join(__dirname, '..');

function jsonResponse(body, status) {
  return {
    ok: status ? status >= 200 && status < 300 : true,
    status: status || 200,
    json: async () => body,
  };
}

function licenseBody(extra) {
  const licenseKey = {
    id: 1,
    status: 'active',
    key: KEY,
    activation_limit: 3,
    activation_usage: 1,
    created_at: '2024-01-01T00:00:00.000000Z',
    expires_at: null,
  };
  const meta = {
    store_id: 55,
    order_id: 2,
    product_id: 1325795,
    product_name: 'ContentSpark Pro',
    variant_id: 2072002,
    variant_name: 'Default',
  };
  return {
    error: null,
    license_key: extra && extra.license_key ? { ...licenseKey, ...extra.license_key } : licenseKey,
    instance: extra && Object.prototype.hasOwnProperty.call(extra, 'instance') ? extra.instance : null,
    meta: extra && extra.meta ? { ...meta, ...extra.meta } : meta,
    ...(extra && extra.top ? extra.top : {}),
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function post(body, headers) {
  return {
    method: 'POST',
    headers: headers || { 'x-forwarded-for': '203.0.113.10' },
    body,
  };
}

function modelPayload() {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          captions: ['One caption'],
          threads: ['A thread'],
          hashtags: ['#coffee'],
          hooks: ['Watch this'],
        }),
      },
    }],
  };
}

function scriptedFetch(steps) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? String(opts.body) : '' });
    const step = steps.shift();
    if (!step) throw new Error('unexpected fetch ' + url);
    if (typeof step === 'function') return step(url, opts);
    return jsonResponse(step.body, step.status);
  };
  fn.calls = calls;
  return fn;
}

test('CORS keeps github.io, contentspark.fyi, and www', () => {
  assert.deepEqual(ALLOW_ORIGINS.slice(0, 3), [
    'https://thadwaugh-dev.github.io',
    'https://contentspark.fyi',
    'https://www.contentspark.fyi',
  ]);
  assert.equal(allowOrigin('https://contentspark.fyi'), 'https://contentspark.fyi');
  assert.equal(allowOrigin('https://www.contentspark.fyi'), 'https://www.contentspark.fyi');
  assert.equal(allowOrigin('https://thadwaugh-dev.github.io'), 'https://thadwaugh-dev.github.io');
  assert.equal(allowOrigin('https://evil.example'), 'https://thadwaugh-dev.github.io');
});

test('generate rejects a missing license before any upstream call', async () => {
  const fetchImpl = scriptedFetch([]);
  const handler = createGenerateHandler({ fetch: fetchImpl, env: { XAI_API_KEY: 'test-key' } });
  const res = mockRes();
  await handler(post({ topic: 'coffee' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'license_required');
  assert.equal(res.body.error, MESSAGES.license_required);
  assert.equal(fetchImpl.calls.length, 0);
});

test('generate rejects the Lemon Squeezy not-found body and does not call the model', async () => {
  const fetchImpl = scriptedFetch([
    { status: 404, body: { valid: false, error: 'license_key not found.' } },
  ]);
  const handler = createGenerateHandler({ fetch: fetchImpl, env: { XAI_API_KEY: 'test-key' } });
  const res = mockRes();
  await handler(post({ topic: 'coffee', license_key: KEY }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'license_invalid');
  assert.equal(res.body.error, MESSAGES.license_invalid);
  assert.equal(JSON.stringify(res.body).includes(KEY), false);
  assert.equal(fetchImpl.calls.length, 1);
  assert.match(fetchImpl.calls[0].url, /\/licenses\/validate$/);
  assert.equal(fetchImpl.calls.some((call) => call.url.includes('api.x.ai')), false);
});

test('generate does not activate a key for a different product', async () => {
  const fetchImpl = scriptedFetch([
    {
      body: licenseBody({
        top: { valid: true },
        meta: { product_id: 999 },
      }),
    },
  ]);
  const handler = createGenerateHandler({ fetch: fetchImpl, env: { XAI_API_KEY: 'test-key' } });
  const res = mockRes();
  await handler(post({ topic: 'coffee', license_key: KEY }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'license_product');
  assert.equal(fetchImpl.calls.some((call) => call.url.includes('/activate')), false);
  assert.equal(fetchImpl.calls.some((call) => call.url.includes('api.x.ai')), false);
});

test('disabled, expired, and activation-limit keys are rejected', async () => {
  const cases = [
    {
      name: 'disabled',
      steps: [{
        body: licenseBody({
          top: { valid: false, error: 'disabled' },
          license_key: { status: 'disabled' },
        }),
      }],
      code: 'license_disabled',
    },
    {
      name: 'expired status',
      steps: [{
        body: licenseBody({
          top: { valid: false, error: 'expired' },
          license_key: { status: 'expired' },
        }),
      }],
      code: 'license_expired',
    },
    {
      name: 'past expires_at',
      steps: [{
        body: licenseBody({
          top: { valid: true },
          license_key: { status: 'active', expires_at: '2020-01-01T00:00:00.000000Z' },
        }),
      }],
      code: 'license_expired',
    },
    {
      name: 'activation limit',
      steps: [
        { body: licenseBody({ top: { valid: true } }) },
        {
          body: licenseBody({
            top: { activated: false, error: 'This license key has reached the activation limit.' },
          }),
        },
      ],
      code: 'license_limit',
    },
  ];

  for (const item of cases) {
    const fetchImpl = scriptedFetch(item.steps);
    const handler = createGenerateHandler({ fetch: fetchImpl, env: { XAI_API_KEY: 'test-key' } });
    const res = mockRes();
    await handler(post({ topic: 'coffee', license_key: KEY }), res);
    assert.equal(res.body.code, item.code, item.name);
    assert.equal(fetchImpl.calls.some((call) => call.url.includes('api.x.ai')), false, item.name);
  }
});

test('a valid key is activated once, then the model runs; variant id is not pinned', async () => {
  const fetchImpl = scriptedFetch([
    {
      body: licenseBody({
        top: { valid: true },
        meta: { variant_id: 999999 },
      }),
    },
    {
      body: licenseBody({
        top: { activated: true },
        instance: { id: INSTANCE, name: 'ContentSpark web' },
        meta: { variant_id: 999999 },
      }),
    },
    { body: modelPayload() },
  ]);
  const handler = createGenerateHandler({
    fetch: fetchImpl,
    env: { XAI_API_KEY: 'test-key' },
  });
  const res = mockRes();
  await handler(post({ topic: 'coffee', license_key: KEY }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.captions, ['One caption']);
  assert.equal(res.body.instance_id, INSTANCE);
  assert.match(fetchImpl.calls[0].url, /\/validate$/);
  assert.match(fetchImpl.calls[1].url, /\/activate$/);
  assert.match(fetchImpl.calls[1].body, /instance_name=ContentSpark\+web/);
  assert.match(fetchImpl.calls[2].url, /api\.x\.ai/);
});

test('a cached instance is not sent to Lemon Squeezy again', async () => {
  const fetchImpl = scriptedFetch([
    {
      body: licenseBody({
        top: { valid: true },
        instance: { id: INSTANCE, name: 'ContentSpark web' },
      }),
    },
  ]);
  const gate = createLicenseGate({ fetch: fetchImpl, now: () => 1_700_000_000_000 });
  const first = await gate.check({
    action: 'generate',
    licenseKey: KEY,
    instanceId: INSTANCE,
    ip: '203.0.113.10',
  });
  const second = await gate.check({
    action: 'generate',
    licenseKey: KEY,
    instanceId: INSTANCE,
    ip: '203.0.113.10',
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(fetchImpl.calls.length, 1);
});

test('rate limit is per IP and per key', async () => {
  const limits = {
    generateIp: [{ limit: 2, windowMs: 60_000 }],
    generateKey: [{ limit: 1, windowMs: 60_000 }],
    licenseIp: [{ limit: 12, windowMs: 60_000 }],
    licenseKey: [{ limit: 12, windowMs: 60_000 }],
  };
  let now = 1_700_000_000_000;
  const fetchImpl = scriptedFetch([
    {
      body: licenseBody({
        top: { valid: true },
        instance: { id: INSTANCE },
      }),
    },
    { body: modelPayload() },
    { status: 404, body: { valid: false, error: 'license_key not found.' } },
  ]);
  const handler = createGenerateHandler({
    fetch: fetchImpl,
    env: { XAI_API_KEY: 'test-key' },
    limits,
    now: () => now,
  });
  const first = mockRes();
  await handler(post({ topic: 'coffee', license_key: KEY, instance_id: INSTANCE }), first);
  assert.equal(first.statusCode, 200);

  const second = mockRes();
  await handler(post({ topic: 'tea', license_key: KEY, instance_id: INSTANCE }), second);
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.code, 'rate_limited');
  assert.ok(Number(second.headers['retry-after']) >= 1);

  const otherIp = mockRes();
  await handler(post(
    { topic: 'tea', license_key: '22222222-2222-4333-8444-555555555555' },
    { 'x-forwarded-for': '203.0.113.99' },
  ), otherIp);
  assert.equal(otherIp.statusCode, 403);
  assert.notEqual(otherIp.body.code, 'rate_limited');
});

test('store id is enforced only when configured', async () => {
  const body = licenseBody({
    top: { valid: true },
    meta: { store_id: 55 },
    instance: { id: INSTANCE, name: 'ContentSpark web' },
  });
  const openFetch = scriptedFetch([{ body }]);
  const open = createLicenseGate({ fetch: openFetch, now: () => 1_700_000_000_000 });
  const allowed = await open.check({
    action: 'activate',
    licenseKey: KEY,
    instanceId: INSTANCE,
    ip: '203.0.113.10',
  });
  assert.equal(allowed.code, 'ok');

  const closedFetch = scriptedFetch([{ body }]);
  const closed = createLicenseGate({
    fetch: closedFetch,
    storeIds: '77',
    now: () => 1_700_000_000_000,
  });
  const denied = await closed.check({
    action: 'activate',
    licenseKey: KEY,
    instanceId: INSTANCE,
    ip: '203.0.113.10',
  });
  assert.equal(denied.code, 'license_store');
});

test('comma-separated product ids accept either id', async () => {
  const fetchImpl = scriptedFetch([
    { body: licenseBody({ top: { valid: true }, meta: { product_id: 4242 }, instance: { id: INSTANCE } }) },
  ]);
  const gate = createLicenseGate({
    fetch: fetchImpl,
    productIds: '1325795, 4242',
    now: () => 1_700_000_000_000,
  });
  const result = await gate.check({
    action: 'activate',
    licenseKey: KEY,
    instanceId: INSTANCE,
    ip: '203.0.113.10',
  });
  assert.equal(result.ok, true);
});

test('license endpoint rejects a fake key and deactivates a real instance', async () => {
  const fetchImpl = scriptedFetch([
    { status: 404, body: { valid: false, error: 'license_key not found.' } },
  ]);
  const handler = createLicenseHandler({ fetch: fetchImpl });
  const rejected = mockRes();
  await handler(post({ license_key: KEY }), rejected);
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.body.ok, false);
  assert.equal(rejected.body.code, 'license_invalid');
  assert.equal(fetchImpl.calls.some((call) => call.url.includes('/activate')), false);

  const deactivateFetch = scriptedFetch([
    { body: { deactivated: true, error: null } },
  ]);
  const deactivate = createLicenseHandler({ fetch: deactivateFetch });
  const res = mockRes();
  await deactivate(post({ action: 'deactivate', license_key: KEY, instance_id: INSTANCE }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.match(deactivateFetch.calls[0].url, /\/deactivate$/);
  assert.match(deactivateFetch.calls[0].body, new RegExp('instance_id=' + INSTANCE));
});

test('generate options preflight echoes a contentspark.fyi origin', async () => {
  const handler = createGenerateHandler({ fetch: scriptedFetch([]) });
  const res = mockRes();
  await handler({
    method: 'OPTIONS',
    headers: { origin: 'https://www.contentspark.fyi' },
  }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-origin'], 'https://www.contentspark.fyi');
});

test('page removes the any-value unlock and keeps the checkout URL', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const checkout = 'https://contentsparkpro.lemonsqueezy.com/checkout/buy/ca205280-0116-4e4e-a5d6-37b4ab667652';
  assert.equal(html.split(checkout).length - 1, 2);
  assert.equal(/localStorage\.setItem\(STORAGE_PRO[^\w_]/.test(html), false);
  assert.equal(html.includes("q.get('pro') === '1'"), false);
  assert.match(html, /id="licenseKeyInput"/);
  assert.match(html, /Enter license key/);
  assert.match(html, /id="licenseRemoveBtn"/);
  assert.match(html, />Remove key</);
  assert.match(html, /Lemon Squeezy receipt email/);
  assert.match(html, /params\.get\('pro'\) === '1'/);
  assert.match(html, /PRO_LICENSE_URL/);
  assert.match(html, /function generateContent/);
});

test('live Lemon Squeezy rejects a fake key through the generate handler', {
  skip: !process.env.LEMONSQUEEZY_LIVE,
}, async () => {
  const handler = createGenerateHandler();
  const res = mockRes();
  await handler(post({
    topic: 'coffee',
    license_key: '00000000-0000-4000-8000-000000000001',
  }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'license_invalid');
  assert.equal(res.body.error, MESSAGES.license_invalid);
  assert.equal(JSON.stringify(res.body).includes('00000000-0000-4000-8000-000000000001'), false);
});
