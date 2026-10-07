'use strict';

/**
 * Servicio de autenticación.
 *
 * Delegate a Supabase Auth (email + password). El access token que devuelve
 * Supabase es el JWT que consume toda la API:
 *  - se devuelve en el body para el SPA (localStorage → Authorization header),
 *  - se refleja en la cookie `zg_session` para las vistas server-rendered.
 */

const { supabaseAnon, supabaseAdmin } = require('../../config/supabase');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/errors');
const { serializeProfile } = require('../../utils/serialize');
const { logger } = require('../../utils/logger');

const SESSION_COOKIE = 'zg_session';
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1h — igual que expires_in de Supabase

/** Traduce errores de Supabase Auth a errores HTTP del API. */
function mapAuthError(error) {
  const msg = error.message || 'Error de autenticación';
  if (/already registered/i.test(msg)) return ApiError.conflict('El correo ya está registrado');
  if (/Invalid login credentials/i.test(msg)) return ApiError.unauthorized('Credenciales inválidas');
  if (/Email not confirmed/i.test(msg)) return ApiError.forbidden('Debes confirmar tu correo antes de entrar');
  if (/Password should be/i.test(msg)) return ApiError.badRequest(msg);
  logger.warn('Supabase auth error', { code: error.code, message: msg });
  return ApiError.badRequest(msg);
}

/** Fija la cookie de sesión que usan las rutas server-rendered (/account). */
function attachSessionCookie(res, token, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: maxAgeMs,
  });
}

async function fetchProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible leer el perfil');
  return serializeProfile(data);
}

/** Registro de usuario. El trigger `handle_new_user` crea la fila en profiles. */
async function register({ email, password, displayName }, res) {
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) throw mapAuthError(error);

  // Si la confirmación de email está deshabilitada, Supabase devuelve sesión.
  if (data.session) {
    attachSessionCookie(res, data.session.access_token, (data.session.expires_in || 3600) * 1000);
  }

  return {
    token: data.session ? data.session.access_token : null,
    requiresEmailConfirmation: !data.session,
    user: data.user
      ? { id: data.user.id, email: data.user.email, displayName: displayName || '' }
      : null,
  };
}

/** Login: devuelve el access token y fija la cookie de sesión. */
async function login({ email, password }, res) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);

  attachSessionCookie(res, data.session.access_token, (data.session.expires_in || 3600) * 1000);

  const profile = await fetchProfile(data.user.id);
  return { token: data.session.access_token, user: profile };
}

/**
 * Logout.
 *
 * El cliente descarta su copia del token (localStorage + cookie). La sesión
 * deja de ser válida cuando expira el access token en Supabase.
 */
async function logout(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return { ok: true };
}

module.exports = { register, login, logout, attachSessionCookie, SESSION_COOKIE };
