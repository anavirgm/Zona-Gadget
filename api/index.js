'use strict';

/**
 * Entry point de Vercel Functions.
 *
 * El runtime de Vercel invoca la exportación como listener HTTP (req, res),
 * y una app de Express YA es un listener con esa firma, así que se exporta
 * directamente (sin serverless-http ni adapter).
 *
 * Ojo: aquí NO se llama app.listen() — Vercel levanta su propio servidor
 * interno y le pasa las peticiones. El arranque local sigue usando
 * `backend/src/server.js` (npm run dev).
 */

const { createApp } = require('../backend/src/app');

module.exports = createApp();
