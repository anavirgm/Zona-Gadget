/**
 * Estado global liviano del SPA:
 *  - usuario en sesión
 *  - carrito persistido en localStorage
 *  - redenciones de cupón activas (hasta confirmar la compra)
 */

import { auth } from './api.js';

const CART_KEY = 'zg_cart';
const REDEMPTIONS_KEY = 'zg_redemptions';

/* ------------------------------- Usuario ------------------------------- */

let currentUser = null;

export function getUser() {
  return currentUser;
}

export function setUser(user) {
  currentUser = user;
}

export function isLoggedIn() {
  return Boolean(currentUser);
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* el cierre de sesión local no depende de la red */
  }
  auth.clear();
  currentUser = null;
}

/* -------------------------------- Carrito ------------------------------ */

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('cart:change'));
}

export function getCart() {
  return readJson(CART_KEY, []);
}

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((i) => i.product_id === product.id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 20);
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      icon: product.icon,
      image_url: product.image_url || null,
      quantity: Math.min(quantity, 20),
    });
  }

  writeJson(CART_KEY, cart);
}

export function updateQuantity(productId, quantity) {
  const cart = getCart().filter((i) => {
    if (i.product_id !== productId) return true;
    i.quantity = Math.max(1, Math.min(quantity, 20));
    return true;
  });
  writeJson(CART_KEY, cart);
}

export function removeFromCart(productId) {
  writeJson(CART_KEY, getCart().filter((i) => i.product_id !== productId));
}

export function clearCart() {
  writeJson(CART_KEY, []);
  writeJson(REDEMPTIONS_KEY, []);
}

export function cartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function cartSubtotalCents() {
  return getCart().reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
}

/* -------------------------- Cupones aplicados --------------------------- */

export function getRedemptions() {
  return readJson(REDEMPTIONS_KEY, []);
}

export function addRedemption(redemption) {
  const current = getRedemptions();
  current.push(redemption);
  writeJson(REDEMPTIONS_KEY, current);
}

export function clearRedemptions() {
  writeJson(REDEMPTIONS_KEY, []);
}

/** Descuento total (%) acumulado por los cupones aplicados. */
export function discountPercent() {
  return Math.min(
    100,
    getRedemptions().reduce((sum, r) => sum + (r.discount_pct || 0), 0)
  );
}
