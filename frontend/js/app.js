/**
 * Bootstrap del SPA.
 *
 * Orden:
 *  1. Hidratar sesión desde el estado del servidor (si la vista fue SSR)
 *     o desde /api/users/me (si hay token en localStorage).
 *  2. Sincronizar navbar y badge del carrito.
 *  3. Montar la ruta actual y activar el router.
 */

import { auth, api } from './api.js';
import { setUser, getUser, cartCount } from './store.js';
import { setupRouter, render, navigate } from './router.js';
import { renderNavAuth, updateCartBadge } from './components.js';

/**
 * Estado inicial inyectado por el backend en rutas server-rendered
 * (window.__INITIAL_STATE__ = JSON.parse('…') → ver backend/src/ssr/index.js).
 */
const initialState = window.__INITIAL_STATE__ || null;

async function bootstrapSession() {
  // 1) Hidratación desde el servidor: ya tenemos el perfil, sin round-trip.
  if (initialState?.user) {
    setUser(initialState.user);
    if (auth.token === null && initialState.token) auth.set(initialState.token);
    return;
  }

  // 2) Sesión normal: validamos contra la API (token localStorage y/o cookie).
  try {
    const { user } = await api('/auth/session');
    setUser(user);
  } catch (err) {
    console.warn('Sin sesión válida, arrancando como invitado', err.status);
    auth.clear();
    setUser(null);
  }
}

async function start() {
  await bootstrapSession();

  renderNavAuth();
  updateCartBadge();

  const navForm = document.getElementById('nav-search');
  navForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(navForm).get('q')?.toString().trim() || '';
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  });

  // Badge en vivo al modificar el carrito desde cualquier vista.
  window.addEventListener('cart:change', updateCartBadge);

  setupRouter();
  await render();
}

start();
