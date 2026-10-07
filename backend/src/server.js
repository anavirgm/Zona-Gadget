'use strict';

/**
 * Punto de entrada del servidor.
 * Arranque con fallo rápido si la config/entorno no es válida.
 */

const { createApp } = require('./app');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const { sessionCache } = require('./utils/tokenCache');

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Zona Gadget API escuchando en http://localhost:${env.port}`, {
    nodeEnv: env.nodeEnv,
  });
});

// Graceful shutdown: corta conexiones activas y limpia la caché de sesiones.
function shutdown(signal) {
  logger.info(`${signal} recibido, cerrando servidor…`, { sessionsCached: sessionCache.size });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
});
