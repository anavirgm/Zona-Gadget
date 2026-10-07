/**
 * Vista: carrito y checkout (/cart)
 */

import { api, ApiError } from '../api.js';
import {
  money,
  escapeHtml,
  toast,
  emptyState,
  icons,
} from '../components.js';
import {
  getCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  cartSubtotalCents,
  getRedemptions,
  addRedemption,
  discountPercent,
  getUser,
} from '../store.js';
import { navigate } from '../router.js';
import { updateCartBadge } from '../components.js';

export async function render() {
  document.title = 'Carrito · Zona Gadget';

  const app = document.getElementById('app');
  const cart = getCart();
  const redemptions = getRedemptions();

  if (cart.length === 0) {
    app.innerHTML = emptyState({
      title: 'Tu carrito está vacío',
      description: 'Explora el catálogo y agrega tus gadgets favoritos.',
      ctaHref: '/shop',
      ctaLabel: 'Ir a la tienda',
    });
    return;
  }

  const subtotal = cartSubtotalCents();
  const pct = discountPercent();
  const discount = Math.round((subtotal * pct) / 100);
  const total = subtotal - discount;

  app.innerHTML = `
    <div class="mb-8 flex items-end justify-between">
      <div>
        <p class="eyebrow">Checkout</p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight text-white">Tu carrito</h1>
      </div>
      <span class="text-sm text-slate-500">${cart.reduce((n, i) => n + i.quantity, 0)} artículo(s)</span>
    </div>

    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Líneas del carrito -->
      <section class="space-y-4 lg:col-span-2">
        ${cart
          .map(
            (item) => `
          <article class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-ink-900 p-4 transition hover:border-white/20 sm:flex-row sm:items-center sm:gap-4" data-id="${escapeHtml(item.product_id)}">
            <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/10 self-start">
              ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="" class="relative z-10 h-full w-full object-contain p-1.5" onerror="this.remove()" />` : `<span class="absolute inset-0 grid place-items-center text-2xl" aria-hidden="true">${escapeHtml(item.icon || '📦')}</span>`}
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-sm font-semibold text-white">${escapeHtml(item.name)}</h2>
              <p class="mt-0.5 text-xs text-slate-500">${money(item.price_cents)} c/u</p>
            </div>
            <div class="flex items-center justify-between gap-3 sm:justify-end">
              <div class="flex items-center rounded-lg border border-white/10 bg-white/5">
                <button class="qty-dec px-2.5 py-1.5 text-slate-400 transition hover:text-white" aria-label="Restar">−</button>
                <span class="w-7 text-center text-xs font-semibold text-white">${item.quantity}</span>
                <button class="qty-inc px-2.5 py-1.5 text-slate-400 transition hover:text-white" aria-label="Sumar">+</button>
              </div>
              <span class="w-24 text-right text-sm font-bold text-white">${money(item.price_cents * item.quantity)}</span>
              <button class="remove text-slate-500 transition hover:text-rose-400" aria-label="Eliminar">✕</button>
            </div>
          </article>`
          )
          .join('')}

        <!-- Cupón -->
        <div class="rounded-2xl border border-white/10 bg-ink-900 p-5">
          <h2 class="text-sm font-semibold text-white">¿Tienes un cupón?</h2>
          <form id="coupon-form" class="mt-3 flex flex-col gap-2 sm:flex-row sm:max-w-md">
            <input id="coupon-code" type="text" placeholder="Ej: WELCOME10" autocomplete="off"
                   class="input flex-1 uppercase placeholder:normal-case" />
            <button type="submit" class="btn-secondary !py-2.5">Aplicar</button>
          </form>
          <div id="applied-coupons" class="mt-3 space-y-2">
            ${redemptions
              .map(
                (r) => `
              <div class="flex items-center justify-between rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs">
                <span class="font-semibold text-emerald-300">Cupón activo · −${r.discount_pct}%</span>
                <button class="text-emerald-400/70 transition hover:text-emerald-200" data-drop="${escapeHtml(r.id)}">quitar</button>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </section>

      <!-- Resumen -->
      <aside class="h-fit rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl shadow-black/30">
        <h2 class="text-sm font-semibold text-white">Resumen</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between text-slate-400"><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
          <div class="flex justify-between text-slate-400">
            <dt>Descuento${pct ? ` (${pct}%)` : ''}</dt>
            <dd class="font-semibold text-emerald-400">−${money(discount)}</dd>
          </div>
          <div class="flex justify-between text-slate-400"><dt>Envío</dt><dd class="text-emerald-400">Gratis</dd></div>
          <div class="mt-4 flex justify-between border-t border-white/10 pt-4 text-base font-bold text-white">
            <dt>Total</dt><dd>${money(total)}</dd>
          </div>
        </dl>

        <button id="btn-checkout" class="btn-primary mt-6 w-full">
          Finalizar compra
        </button>
        <p class="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate-400">${icons.lock} Pago 100% seguro con cifrado SSL. Aceptamos Zelle, Pago Móvil y tarjetas.</p>
      </aside>
    </div>
  `;

  /* --------------------------- Eventos --------------------------- */

  app.querySelectorAll('article[data-id]').forEach((row) => {
    const id = row.dataset.id;
    const item = cart.find((i) => i.product_id === id);

    row.querySelector('.qty-dec').addEventListener('click', () => {
      updateQuantity(id, item.quantity - 1);
      render();
    });
    row.querySelector('.qty-inc').addEventListener('click', () => {
      updateQuantity(id, item.quantity + 1);
      render();
    });
    row.querySelector('.remove').addEventListener('click', () => {
      removeFromCart(id);
      updateCartBadge();
      render();
    });
  });

  // Aplicar cupón → POST /api/coupons/apply
  app.querySelector('#coupon-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = app.querySelector('#coupon-code');
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    button.textContent = 'Aplicando…';

    try {
      const result = await api('/coupons/apply', { method: 'POST', body: { code } });
      addRedemption({
        id: result.redemption.id,
        coupon_id: result.coupon.code,
        discount_pct: result.coupon.discount_pct,
      });
      toast(`Cupón ${result.coupon.code} aplicado: −${result.coupon.discount_pct}%`);
      render();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No se pudo aplicar el cupón';
      toast(message, 'error');
      button.disabled = false;
      button.textContent = 'Aplicar';
    }
  });

  // Quitar cupón aplicado (solo estado local; la redención queda en la BD
  // hasta que el checkout la descarte por no estar ligada a ninguna orden).
  app.querySelectorAll('[data-drop]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const remaining = getRedemptions().filter((r) => r.id !== btn.dataset.drop);
      localStorage.setItem('zg_redemptions', JSON.stringify(remaining));
      render();
    });
  });

  // Checkout → POST /api/orders
  app.querySelector('#btn-checkout').addEventListener('click', async (event) => {
    if (!getUser()) {
      toast('Inicia sesión para finalizar tu compra', 'info');
      navigate('/login?next=/cart');
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Procesando…';

    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          redemptionIds: getRedemptions().map((r) => r.id),
        },
      });

      clearCart();
      updateCartBadge();
      toast(`¡Pedido ${order.id.slice(0, 8)} confirmado por ${money(order.total_cents)}!`);
      navigate('/account');
    } catch (err) {
      toast(err.message || 'No se pudo procesar el pedido', 'error');
      button.disabled = false;
      button.textContent = 'Finalizar compra';
    }
  });
}
