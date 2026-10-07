'use strict';

/**
 * Rate limiter en memoria (sliding window por IP).
 *
 * Suficiente para la instancia única desplegada actualmente; si escalamos a
 * múltiples réplicas lo reemplazaremos por Redis o por el WAF del CDN.
 */

const { ApiError } = require('../utils/errors');

function rateLimit({ windowMs, max, scope }) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  // Limpieza periódica para evitar crecimiento no acotado del Map.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const alive = timestamps.filter((t) => now - t < windowMs);
      if (alive.length === 0) hits.delete(key);
      else hits.set(key, alive);
    }
  }, windowMs);
  sweep.unref();

  return (req, _res, next) => {
    const now = Date.now();
    const key = `${scope}:${req.ip}`;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfterMs = windowMs - (now - recent[0]);
      return next(
        Object.assign(
          ApiError.badRequest('Demasiadas peticiones. Intenta de nuevo en unos segundos.'),
          { status: 429, code: 'rate_limited', retryAfter: Math.ceil(retryAfterMs / 1000) }
        )
      );
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

module.exports = { rateLimit };
