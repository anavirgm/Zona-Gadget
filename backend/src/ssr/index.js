'use strict';

/**
 * Server-side rendering de la vista de cuenta.
 *
 * El SPA necesita los datos del perfil ANTES del primer paint de /account
 * (evita el flash de contenido vacío y mejora LCP en esta vista). La solución:
 * renderizar `index.html` con el estado del usuario embebido en un slot de
 * bootstrap que el cliente hidrata:
 *
 *   window.__INITIAL_STATE__ = JSON.parse('{ ... }');
 *
 * La plantilla se lee una vez al arrancar; por request solo se inyecta el
 * estado. El contenido del perfil ya pasó por la validación del API y se
 * serializa como JSON UTF-8 imprimible.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { resolveUserFromRequest } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

const FRONTEND_DIR = path.resolve(__dirname, '../../../frontend');
const TEMPLATE_PATH = path.join(FRONTEND_DIR, 'index.html');
const BOOTSTRAP_SLOT = 'window.__INITIAL_STATE__ = null;';

let cachedTemplate = null;

function loadTemplate() {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  }
  return cachedTemplate;
}

function renderWithState(state) {
  const json = JSON.stringify(state);
  const bootstrap = `window.__INITIAL_STATE__ = JSON.parse('${json}');`;
  return loadTemplate().replace(BOOTSTRAP_SLOT, bootstrap);
}

router.get('/account', async (req, res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    res
      .type('html')
      .send(renderWithState({ route: 'account', hydratedAt: Date.now(), user }));
  } catch (err) {
    // Sin sesión válida → el SPA retoma en /login y vuelve después.
    logger.debug('SSR /account sin sesión, redirigiendo a login', { reason: err.message });
    res.redirect('/login?next=/account');
  }
});

module.exports = { ssrRouter: router, renderWithState };
