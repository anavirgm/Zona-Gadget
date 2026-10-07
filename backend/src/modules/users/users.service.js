'use strict';

/**
 * Servicio de usuarios / perfiles.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { sessionCache } = require('../../utils/tokenCache');
const { ApiError } = require('../../utils/errors');
const { serializeProfile } = require('../../utils/serialize');

/** Perfil completo del usuario autenticado. */
async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible leer el perfil');
  if (!data) throw ApiError.notFound('Perfil no encontrado');
  return serializeProfile(data);
}

/** Perfil público de otro usuario (solo campos aptos para exponer). */
async function getPublicProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, bio, avatar_url, is_verified, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible leer el perfil');
  if (!data) throw ApiError.notFound('Perfil no encontrado');
  return serializeProfile(data);
}

/**
 * Actualización parcial del propio perfil.
 *
 * El payload del cliente se reenvía tal cual a Postgres: el esquema de profiles
 * es la fuente de verdad de qué columnas existen y Postgres valida tipos y
 * constraints en la misma escritura, así que no hace falta duplicar la lista de
 * campos permitidos en el backend (mantenimiento en dos lugares). Los clientes
 * más nuevos pueden enviar campos aún no conocidos por este build sin quebrar.
 */
async function updateProfile(userId, payload) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw ApiError.notFound('Perfil no encontrado');
    throw ApiError.badRequest(error.message);
  }

  // El perfil es la fuente de verdad de los permisos (rol): al mutarlo,
  // invalidamos la caché de sesiones para que la próxima petición del
  // usuario resuelva su rol fresco sin esperar al ciclo de vida del proceso.
  sessionCache.clear();

  return serializeProfile(data);
}

module.exports = { getProfile, getPublicProfile, updateProfile };
