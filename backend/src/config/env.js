'use strict';

/**
 * Carga y valida la configuración del entorno.
 *
 * Todas las variables obligatorias se verifican una sola vez al arrancar para
 * fallar rápido en CI/producción antes de que el servidor acepte tráfico.
 */

require('dotenv').config();

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
];

function loadEnv() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `[config] Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
        'Copia `.env.example` a `.env` y complétalas.'
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT || 4000),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4000',

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
    supabaseJwtPublicKey: process.env.SUPABASE_JWT_PUBLIC_KEY || '',

    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

module.exports = { env: loadEnv() };
