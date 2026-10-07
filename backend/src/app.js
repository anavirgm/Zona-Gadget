'use strict';

/**
 * Composición de la aplicación Express.
 *
 * Orden de la cadena de middlewares/routers:
 *   1. Seguridad/observabilidad base (helmet, cors, json, cookies, logs)
 *   2. API REST (/api/…)
 *   3. Vistas server-renderizadas (/account → hidratación de estado)
 *   4. Assets estáticos del SPA (frontend/)
 *   5. Fallback SPA (history API routing) + manejo central de errores
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { ssrRouter } = require('./ssr');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const productsRoutes = require('./modules/products/products.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const couponsRoutes = require('./modules/coupons/coupons.routes');
const adminRoutes = require('./modules/admin/admin.routes');

const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

function createApp() {
  const app = express();

  app.set('trust proxy', 1); // detrás del load balancer / CDN
  app.disable('x-powered-by');

  // CSP y el resto de headers las resuelve el CDN en producción; aquí
  // mantenemos el set base de helmet sin CSP para no interferir con el
  // bundle del SPA.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // ---------------------------------------------------------------- API
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', uptime: process.uptime(), env: env.nodeEnv })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/coupons', couponsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', notFound); // cualquier /api/* desconocido → 404 JSON

  // ------------------------------------------------- Vistas server-side
  app.use(ssrRouter);

  // ---------------------------------------------------- Assets estáticos
  app.use(
    express.static(FRONTEND_DIR, {
      index: false,
      maxAge: env.isProduction ? '1h' : 0,
    })
  );

  // --------------------------------------------------------- Fallback SPA
  // History API routing: toda ruta no-API sirve el shell del SPA.
  const indexHtml = path.join(FRONTEND_DIR, 'index.html');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    return res.sendFile(indexHtml);
  });

  // ------------------------------------------------------------- Errores
  app.use(notFound);
  app.use(errorHandler);

  logger.info('App Express compuesta', { frontend: FRONTEND_DIR });
  return app;
}

module.exports = { createApp };
