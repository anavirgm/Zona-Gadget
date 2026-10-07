/**
 * Vista: detalle de producto (/product/:id)
 */

import { api } from '../api.js';
import { money, escapeHtml, toast, productCard, skeletonCards, productMedia, stars, icons } from '../components.js';
import { addToCart } from '../store.js';
import { updateCartBadge } from '../components.js';

export async function render(productId) {
  document.title = 'Producto · Zona Gadget';

  const app = document.getElementById('app');
  app.innerHTML = `<div class="grid gap-8 lg:grid-cols-2">
      <div class="skeleton h-96 rounded-3xl border border-white/10"></div>
      <div class="space-y-4"><div class="skeleton h-8 w-2/3 rounded-lg"></div><div class="skeleton h-6 w-1/3 rounded-lg"></div><div class="skeleton h-24 rounded-lg"></div><div class="skeleton h-12 w-40 rounded-xl"></div></div>
    </div>`;

  let product;
  try {
    ({ product } = await api(`/products/${encodeURIComponent(productId)}`));
  } catch (err) {
    if (err.status === 404) {
      app.innerHTML = `<div class="mx-auto max-w-md py-24 text-center">
          <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
            <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7"/><path d="m15.5 8.5-7 7"/></svg>
          </span>
          <h1 class="mt-6 text-2xl font-bold tracking-tight text-white">Producto no encontrado</h1>
          <a href="/shop" class="btn-primary mt-8 inline-flex">Volver a la tienda</a>
        </div>`;
      return;
    }
    throw err;
  }

  document.title = `${product.name} · Zona Gadget`;

  app.innerHTML = `
    <nav class="mb-6 flex items-center gap-2 text-xs text-slate-500">
      <a href="/" class="transition hover:text-white">Inicio</a><span>/</span>
      <a href="/shop" class="transition hover:text-white">Tienda</a><span>/</span>
      <a href="/shop?category=${encodeURIComponent(product.category)}" class="transition hover:text-white">${escapeHtml(product.category)}</a>
    </nav>

    <div class="grid gap-10 rounded-3xl border border-white/10 bg-ink-900 p-6 sm:p-10 lg:grid-cols-2">
      <!-- Gallery: foto real con zoom al hover (icono como respaldo) -->
      <div class="group relative lg:sticky lg:top-24 lg:self-start">
        ${productMedia(product, { ratio: 'aspect-[4/3] rounded-2xl', zoom: true })}
        ${product.compare_at_cents ? `<span class="absolute left-4 top-4 z-20 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-rose-500/30">−${Math.round((1 - product.price_cents / product.compare_at_cents) * 100)}%</span>` : ''}
        <div class="mt-4 flex flex-wrap gap-2">
          ${['Garantía 24 meses', 'Stock listo', 'Despacho 24–72 h']
            .map((t) => `<span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">${t}</span>`)
            .join('')}
        </div>
      </div>

      <!-- Info -->
      <div class="flex flex-col">
        <p class="text-xs font-semibold uppercase tracking-widest text-indigo-400">${escapeHtml(product.category)}</p>
        <h1 class="mt-2 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">${escapeHtml(product.name)}</h1>

        <div class="mt-3 flex items-center gap-3 text-xs text-slate-500">
          ${stars(5)}
          <span>128 reseñas verificadas</span>
        </div>

        <div class="mt-6 flex items-baseline gap-3">
          <span class="text-4xl font-extrabold tracking-tight text-white">${money(product.price_cents)}</span>
          ${product.compare_at_cents ? `<span class="text-lg text-slate-500 line-through">${money(product.compare_at_cents)}</span>` : ''}
        </div>

        <p class="mt-5 text-sm leading-7 text-slate-400">${escapeHtml(product.description)}</p>

        <div class="mt-6 grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
          <span class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"><span class="text-indigo-300">${icons.truck}</span> Envío 24–72 h</span>
          <span class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"><span class="text-emerald-300">${icons.shield}</span> Garantía 24 meses</span>
          <span class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"><span class="text-cyan-300">${icons.box}</span> ${product.stock > 0 ? `${product.stock} en stock` : 'Por confirmar'}</span>
        </div>

        <div class="mt-8 flex items-center gap-3">
          <div class="flex items-center rounded-xl border border-white/10 bg-white/5">
            <button id="qty-dec" class="px-3.5 py-3 text-slate-400 transition hover:text-white" aria-label="Restar">−</button>
            <span id="qty" class="w-8 text-center text-sm font-semibold text-white">1</span>
            <button id="qty-inc" class="px-3.5 py-3 text-slate-400 transition hover:text-white" aria-label="Sumar">+</button>
          </div>
          <button id="btn-add" class="btn-primary flex-1 disabled:cursor-not-allowed">
            Agregar al carrito
          </button>
        </div>
        ${product.stock === 0 ? '<p class="mt-3 text-xs text-rose-400">Sin stock por el momento.</p>' : ''}
        <p class="mt-4 flex items-center gap-1.5 text-[11px] text-slate-600">${icons.lock} Pago 100% seguro con cifrado SSL. Aceptamos Zelle, Pago Móvil y tarjetas.</p>
      </div>
    </div>

    <!-- Relacionados -->
    <section class="mt-16">
      <h2 class="mb-5 text-xl font-bold tracking-tight text-white">También te puede gustar</h2>
      <div id="related" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">${skeletonCards(4)}</div>
    </section>
  `;

  // Selector de cantidad + agregar al carrito.
  let qty = 1;
  const qtyEl = document.getElementById('qty');
  document.getElementById('qty-dec').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyEl.textContent = String(qty);
  });
  document.getElementById('qty-inc').addEventListener('click', () => {
    qty = Math.min(20, qty + 1);
    qtyEl.textContent = String(qty);
  });

  const addButton = document.getElementById('btn-add');
  addButton.disabled = product.stock === 0;
  addButton.addEventListener('click', () => {
    addToCart(product, qty);
    updateCartBadge();
    toast(`${product.name} agregado al carrito`);
  });

  // Relacionados: mismos productos del catálogo menos el actual.
  try {
    const { products } = await api(`/products?category=${encodeURIComponent(product.category)}`);
    const related = products.filter((p) => p.id !== product.id).slice(0, 4);
    const container = document.getElementById('related');
    if (container) container.innerHTML = related.length ? related.map(productCard).join('') : '';
  } catch {
    /* los relacionados son best-effort */
  }
}
