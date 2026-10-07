'use strict';

/**
 * Clientes de Supabase.
 *
 * - `supabaseAnon`: usa la anon key. Respeta las políticas RLS; se emplea en
 *   flujos de autenticación (signUp / signInWithPassword).
 * - `supabaseAdmin`: usa la service role key. Bypasea RLS por diseño; la
 *   capa de servicio es la responsable de aplicar los filtros por usuario.
 */

const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');
const { logger } = require('../utils/logger');

const BASE_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: { 'x-application-name': 'zona-gadget-api' },
  },
};

const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, BASE_OPTIONS);

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  ...BASE_OPTIONS,
  auth: { ...BASE_OPTIONS.auth, persistSession: false },
});

logger.info('Clientes de Supabase inicializados', {
  authFlows: 'anon-key',
  dataAccess: 'service-role (RLS aplicada en capa de servicio)',
});

module.exports = { supabaseAnon, supabaseAdmin };
