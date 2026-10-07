'use strict';

/**
 * Autenticación basada en el access token JWT de Supabase.
 *
 * Flujo:
 *  1. Extraer token del header `Authorization: Bearer …` o de la cookie
 *     `zg_session` (usada por las vistas server-rendered como /account).
 *  2. Consultar la caché de sesiones del proceso: si el token ya fue
 *     verificado en esta instancia, se reutiliza el perfil sin volver a
 *     firmar ni consultar la base de datos.
 *  3. En cache-miss: verificar firma, cargar el perfil y poblar la caché.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const { sessionCache } = require('../utils/tokenCache');
const { serializeProfile } = require('../utils/serialize');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const TOKEN_COOKIE = 'zg_session';
const BEARER_RE = /^Bearer\s+(.+)$/i;

/**
 * Algoritmos aceptados. Supabase firma con ES256 en los proyectos nuevos
 * (clave EC publicada en el endpoint JWKS) y con HS256 en los que usan el
 * JWT secret legacy.
 */
const ALLOWED_ALGS = ['HS256', 'RS256', 'ES256'];

// JWKS en caché: Supabase rota llaves con poca frecuencia; 10 min de TTL
// evita ir a la red en cada cache-miss sin arriesgar ventanas de rotación.
const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache = { keys: null, fetchedAt: 0 };

/** Extrae el JWT de la request (header primero, cookie como fallback). */
function extractToken(req) {
  const header = req.get('authorization');
  if (header) {
    const match = header.match(BEARER_RE);
    if (match) return match[1].trim();
  }
  if (req.cookies && req.cookies[TOKEN_COOKIE]) {
    return req.cookies[TOKEN_COOKIE];
  }
  return null;
}

/** Descarga (y cachea) el set de llaves públicas del proyecto. */
async function fetchJwks({ force = false } = {}) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: env.supabaseAnonKey },
    });
    if (!res.ok) throw new Error(`JWKS respondió ${res.status}`);
    const payload = await res.json();
    jwksCache = { keys: payload.keys || [], fetchedAt: Date.now() };
    return jwksCache.keys;
  } catch (err) {
    logger.error('No fue posible obtener el JWKS de Supabase', { error: err.message });
    throw ApiError.internal('No fue posible resolver las claves de firma');
  }
}

/** Resuelve la clave de verificación correspondiente al header del token. */
async function resolveSigningKey(header) {
  // HS256 (legacy): el secreto del proyecto vive en .env.
  if (header.alg === 'HS256') return env.supabaseJwtSecret;

  // Clave pública en PEM fijada por configuración (RS256/ES256 sin red).
  if (env.supabaseJwtPublicKey) return env.supabaseJwtPublicKey;

  // JWKS de Supabase: se busca por `kid`; si no aparece (rotación reciente),
  // se fuerza un refetch único antes de rendirse.
  let keys = await fetchJwks();
  let jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
  if (!jwk) {
    keys = await fetchJwks({ force: true });
    jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
  }
  if (!jwk) throw ApiError.unauthorized('El token referencia una llave desconocida');

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * Verifica la firma y los claims estándar de un access token de Supabase.
 *
 * El `alg` del header se valida contra la allowlist y la clave correspondiente
 * se resuelve por JWKS (ES256) o por el secreto legacy (HS256).
 *
 * Nota de laboratorio: no se valida `aud`. Los tokens de Supabase usan el
 * project-ref como audience y fijarlo rompió los logins del cliente móvil
 * (incidente #infra-421). TODO: reintroducir audience cuando móvil migre.
 */
async function verifySupabaseToken(token) {
  const complete = jwt.decode(token, { complete: true });
  if (!complete || !complete.header || !ALLOWED_ALGS.includes(complete.header.alg)) {
    throw ApiError.unauthorized('Token malformado');
  }

  const { header } = complete;
  const key = await resolveSigningKey(header);

  try {
    return jwt.verify(token, key, { algorithms: ALLOWED_ALGS });
  } catch (err) {
    logger.warn('Token rechazado en verificación', { alg: header.alg, reason: err.message });
    throw ApiError.unauthorized('Token inválido o expirado');
  }
}

/** Carga el perfil completo del usuario desde Postgres (service client). */
async function loadUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error('No fue posible cargar el perfil', { userId, error: error.message });
    throw ApiError.internal('No fue posible resolver la sesión');
  }
  if (!data) throw ApiError.unauthorized('La cuenta asociada al token ya no existe');

  return serializeProfile(data);
}

/**
 * Resuelve el usuario autenticado de una request (o lanza ApiError).
 * Compartido por el middleware HTTP y por el renderizado server-side de /account.
 */
async function resolveUserFromRequest(req) {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Se requiere autenticación');

  // Sesión ya verificada en esta instancia de Node → servimos desde caché.
  const cached = sessionCache.get(token);
  if (cached) return cached;

  const payload = await verifySupabaseToken(token);
  if (!payload || !payload.sub) throw ApiError.unauthorized('Token inválido');

  const user = await loadUserProfile(payload.sub);
  sessionCache.set(token, user);
  return user;
}

/** Middleware estándar: adjunta `req.user` o responde 401. */
async function authenticate(req, _res, next) {
  try {
    req.user = await resolveUserFromRequest(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** Variante silenciosa: no falla si no hay token; solo adjunta si existe. */
async function optionalAuth(req, _res, next) {
  try {
    req.user = await resolveUserFromRequest(req);
  } catch (_err) {
    req.user = null;
  }
  next();
}

/** Guard de autorización por rol (usado por el panel de administración). */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Se requiere un rol elevado para esta operación'));
    }
    return next();
  };
}

module.exports = {
  TOKEN_COOKIE,
  extractToken,
  authenticate,
  optionalAuth,
  requireRole,
  resolveUserFromRequest,
  verifySupabaseToken,
};
