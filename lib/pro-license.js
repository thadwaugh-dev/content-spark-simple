/**
 * Lemon Squeezy public License API (no API key).
 * Validate the key, then activate once per browser so the activation limit
 * (3 on ContentSpark Pro) is not spent on every generate call.
 * Product id defaults to 1325795. Variant id is not checked: test variant
 * 2072002 and the later live variant must both work.
 */

const LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses/';
const DEFAULT_PRODUCT_ID = '1325795';
const INSTANCE_NAME = 'ContentSpark web';
const CACHE_MS = 5 * 60 * 1000;
const KEY_MAX = 128;

const MESSAGES = {
  license_required: 'A Pro license key is required.',
  license_invalid: 'That license key is not valid.',
  license_disabled: 'This license key is disabled.',
  license_expired: 'This license key has expired.',
  license_product: 'This license key is not for ContentSpark Pro.',
  license_store: 'This license key is not for this store.',
  license_limit: 'This license key has no activations left. Remove it from another browser, then try again.',
  license_unavailable: 'License check is unavailable. Try again in a minute.',
  rate_limited: 'Too many requests. Wait a few minutes and try again.',
  license_instance: 'No device id is stored for this key.',
};

const DEFAULT_LIMITS = {
  generateIp: [
    { limit: 8, windowMs: 60 * 1000 },
    { limit: 30, windowMs: 60 * 60 * 1000 },
  ],
  generateKey: [
    { limit: 8, windowMs: 60 * 1000 },
    { limit: 30, windowMs: 60 * 60 * 1000 },
  ],
  licenseIp: [{ limit: 12, windowMs: 10 * 60 * 1000 }],
  licenseKey: [{ limit: 12, windowMs: 10 * 60 * 1000 }],
};

function idList(value, fallback) {
  const raw = value == null || String(value).trim() === '' ? fallback : value;
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesId(actual, allowed) {
  if (actual == null || !allowed.length) return false;
  return allowed.includes(String(actual));
}

function createLimiter(limit, windowMs) {
  const buckets = new Map();
  return {
    hit(id, now) {
      const bucket = buckets.get(id);
      if (!bucket || now - bucket.start >= windowMs) {
        buckets.set(id, { start: now, count: 1 });
        return { ok: true };
      }
      if (bucket.count >= limit) {
        return { ok: false, retryAfterMs: windowMs - (now - bucket.start) };
      }
      bucket.count += 1;
      return { ok: true };
    },
  };
}

function buildLimiters(specs) {
  return specs.map((spec) => createLimiter(spec.limit, spec.windowMs));
}

function take(limiters, id, now) {
  for (const limiter of limiters) {
    const result = limiter.hit(id, now);
    if (!result.ok) {
      return {
        ok: false,
        terminal: true,
        status: 429,
        code: 'rate_limited',
        error: MESSAGES.rate_limited,
        retryAfterMs: result.retryAfterMs || 1000,
      };
    }
  }
  return null;
}

function fail(code, status) {
  return {
    ok: false,
    terminal: true,
    status: status || 403,
    code,
    error: MESSAGES[code] || MESSAGES.license_invalid,
  };
}

function createLicenseGate(options = {}) {
  const fetchImpl = options.fetch || fetch;
  const nowFn = options.now || Date.now;
  const cacheMs = options.cacheMs == null ? CACHE_MS : options.cacheMs;
  const productIds = idList(
    options.productIds !== undefined ? options.productIds : process.env.LEMONSQUEEZY_PRODUCT_ID,
    DEFAULT_PRODUCT_ID,
  );
  if (!productIds.length) productIds.push(DEFAULT_PRODUCT_ID);
  const storeIds = idList(
    options.storeIds !== undefined ? options.storeIds : process.env.LEMONSQUEEZY_STORE_ID,
    '',
  );
  const limits = options.limits || DEFAULT_LIMITS;
  const generateIp = buildLimiters(limits.generateIp || DEFAULT_LIMITS.generateIp);
  const generateKey = buildLimiters(limits.generateKey || DEFAULT_LIMITS.generateKey);
  const licenseIp = buildLimiters(limits.licenseIp || DEFAULT_LIMITS.licenseIp);
  const licenseKey = buildLimiters(limits.licenseKey || DEFAULT_LIMITS.licenseKey);
  const cache = new Map();
  const inflight = new Map();

  function productOk(productId) {
    return matchesId(productId, productIds);
  }

  function storeOk(storeId) {
    if (!storeIds.length) return true;
    return matchesId(storeId, storeIds);
  }

  function isPast(value, now) {
    if (value == null || value === '') return false;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return false;
    return parsed <= now;
  }

  function instanceFrom(data) {
    const raw = data && data.instance && data.instance.id != null ? String(data.instance.id).trim() : '';
    return /^[A-Za-z0-9-]{1,64}$/.test(raw) ? raw : '';
  }

  function judge(data, context) {
    if (!data || typeof data !== 'object') return fail('license_unavailable', 503);
    const license = data.license_key && typeof data.license_key === 'object' ? data.license_key : null;
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : null;
    const status = license && license.status ? String(license.status) : '';
    const flag = context.fromActivate ? data.activated === true : data.valid === true;
    const instanceId = instanceFrom(data);

    if (status === 'disabled') return fail('license_disabled', 403);
    if (status === 'expired' || isPast(license && license.expires_at, context.now)) {
      return fail('license_expired', 403);
    }
    if (meta && !productOk(meta.product_id)) {
      return {
        ...fail('license_product', 403),
        rollback: Boolean(context.fromActivate && instanceId),
        instanceId,
      };
    }
    if (meta && !storeOk(meta.store_id)) return fail('license_store', 403);

    if (!flag) {
      const err = String(data.error || '');
      if (/activation limit/i.test(err)) return fail('license_limit', 403);
      // A bad instance id should not condemn the key. The caller validates the
      // key on its own and only then spends an activation.
      if (context.hadInstance) return { ok: false, terminal: false, needsActivation: true };
      return fail('license_invalid', 403);
    }

    if (!meta || !productOk(meta.product_id)) {
      return {
        ...fail('license_product', 403),
        rollback: Boolean(context.fromActivate && instanceId),
        instanceId,
      };
    }
    if (!storeOk(meta.store_id)) return fail('license_store', 403);

    if (context.fromActivate) {
      if (!instanceId) return fail('license_unavailable', 503);
      return { ok: true, status: 200, code: 'ok', instanceId };
    }
    if (instanceId) return { ok: true, status: 200, code: 'ok', instanceId };
    return { ok: false, terminal: false, needsActivation: true };
  }

  async function postLicense(path, params) {
    const body = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value != null && value !== '') body.set(key, String(value));
    });
    let res;
    try {
      res = await fetchImpl(LICENSE_API + path, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { transport: true };
    }
    if (res.status === 429) return { busy: true };
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!data || typeof data !== 'object') return { transport: true };
    return { data };
  }

  function unavailable() {
    return fail('license_unavailable', 503);
  }

  function cacheGet(licenseKey, instanceId, now) {
    if (!cacheMs || !instanceId) return null;
    const row = cache.get(licenseKey);
    if (!row) return null;
    const hit = row.get(instanceId);
    if (!hit || hit.exp <= now) return null;
    return { ok: true, status: 200, code: 'ok', instanceId: hit.instanceId };
  }

  function cacheSet(licenseKey, instanceId, now) {
    if (!cacheMs || !instanceId) return;
    let row = cache.get(licenseKey);
    if (!row) {
      row = new Map();
      cache.set(licenseKey, row);
    }
    row.set(instanceId, { exp: now + cacheMs, instanceId });
  }

  function cacheDrop(licenseKey) {
    cache.delete(licenseKey);
  }

  async function activate(licenseKey, now) {
    const posted = await postLicense('activate', {
      license_key: licenseKey,
      instance_name: INSTANCE_NAME,
    });
    if (posted.transport || posted.busy) return unavailable();
    const judged = judge(posted.data, { fromActivate: true, hadInstance: false, now });
    if (judged.rollback && judged.instanceId) {
      await postLicense('deactivate', {
        license_key: licenseKey,
        instance_id: judged.instanceId,
      });
    }
    if (judged.ok) cacheSet(licenseKey, judged.instanceId, now);
    return judged;
  }

  async function doEnsure(licenseKey, instanceId, now) {
    if (instanceId) {
      const cached = cacheGet(licenseKey, instanceId, now);
      if (cached) return cached;
      const posted = await postLicense('validate', {
        license_key: licenseKey,
        instance_id: instanceId,
      });
      if (posted.transport || posted.busy) return unavailable();
      const judged = judge(posted.data, { fromActivate: false, hadInstance: true, now });
      if (judged.ok) {
        cacheSet(licenseKey, judged.instanceId || instanceId, now);
        return { ...judged, instanceId: judged.instanceId || instanceId };
      }
      if (judged.terminal) return judged;
    }

    const posted = await postLicense('validate', { license_key: licenseKey });
    if (posted.transport || posted.busy) return unavailable();
    const pre = judge(posted.data, { fromActivate: false, hadInstance: false, now });
    if (pre.terminal) return pre;
    if (pre.ok && pre.instanceId) {
      cacheSet(licenseKey, pre.instanceId, now);
      return pre;
    }
    return activate(licenseKey, now);
  }

  function ensureOnce(licenseKey, instanceId, now) {
    const pending = inflight.get(licenseKey);
    if (pending) return pending;
    const promise = doEnsure(licenseKey, instanceId, now).finally(() => {
      inflight.delete(licenseKey);
    });
    inflight.set(licenseKey, promise);
    return promise;
  }

  async function doDeactivate(licenseKey, instanceId) {
    if (!instanceId) return fail('license_instance', 400);
    const posted = await postLicense('deactivate', {
      license_key: licenseKey,
      instance_id: instanceId,
    });
    cacheDrop(licenseKey);
    if (posted.transport || posted.busy) return unavailable();
    if (posted.data && posted.data.deactivated === true) {
      return { ok: true, status: 200, code: 'ok' };
    }
    return fail('license_invalid', 403);
  }

  function limitersFor(action) {
    if (action === 'generate') return { ip: generateIp, key: generateKey };
    return { ip: licenseIp, key: licenseKey };
  }

  async function check(input) {
    const now = nowFn();
    const action = input && input.action === 'generate'
      ? 'generate'
      : input && input.action === 'deactivate'
        ? 'deactivate'
        : 'activate';
    const rawKey = input && typeof input.licenseKey === 'string' ? input.licenseKey.trim() : '';
    const instanceId = input && typeof input.instanceId === 'string'
      && /^[A-Za-z0-9-]{1,64}$/.test(input.instanceId.trim())
      ? input.instanceId.trim()
      : '';
    const ip = input && input.ip ? String(input.ip).slice(0, 64) : 'unknown';
    const groups = limitersFor(action);

    if (!rawKey || rawKey.length > KEY_MAX) {
      const blocked = take(groups.ip, ip, now);
      if (blocked) return blocked;
      return rawKey.length > KEY_MAX ? fail('license_invalid', 403) : fail('license_required', 401);
    }

    const ipBlocked = take(groups.ip, ip, now);
    if (ipBlocked) return ipBlocked;
    const keyBlocked = take(groups.key, rawKey, now);
    if (keyBlocked) return keyBlocked;

    if (action === 'deactivate') return doDeactivate(rawKey, instanceId);
    return ensureOnce(rawKey, instanceId, now);
  }

  return { check };
}

module.exports = {
  CACHE_MS,
  DEFAULT_PRODUCT_ID,
  MESSAGES,
  createLicenseGate,
};
