/**
 * Vista: portada (/)
 *
 * Hero bento con fotos reales del catálogo + categorías + destacados +
 * banner de cupón + value props con iconos SVG.
 */

import { api } from '../api.js';
import { escapeHtml, productCard, skeletonCards, icons } from '../components.js';

const CATEGORIES = [
  { name: 'Celulares', accent: 'sky' },
  { name: 'Laptops', accent: 'indigo' },
  { name: 'Audio', accent: 'violet' },
  { name: 'Gaming', accent: 'rose' },
  { name: 'Wearables', accent: 'cyan' },
  { name: 'Drones', accent: 'sky' },
  { name: 'Monitores', accent: 'emerald' },
  { name: 'Tablets', accent: 'teal' },
];

/** Foto del hero: figura con fondo degradado; si la foto falta, queda el fondo. */
function heroShot(slug, alt, extraClass = '') {
  return `
    <figure class="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 via-ink-800 to-ink-900 shadow-2xl shadow-black/50 ${extraClass}">
      <img src="/assets/products/${slug}.jpg" alt="${escapeHtml(alt)}" decoding="async"
           class="h-full w-full object-cover transition duration-700 hover:scale-105"
           onerror="this.remove()" />
    </figure>`;
}

export async function render() {
  document.title = 'Zona Gadget — Equipos y gadgets de tecnología';

  const app = document.getElementById('app');
  app.innerHTML = `
    <!-- ============================== HERO ============================== -->
    <section class="noise relative overflow-hidden rounded-3xl border border-white/15 bg-ink-900/95 shadow-2xl shadow-black/50">
      <!-- Blobs de color + retícula -->
      <div class="blob -top-32 -left-20 h-80 w-80 bg-indigo-600/40"></div>
      <div class="blob bottom-[-10%] right-[-10%] h-72 w-72 bg-cyan-500/25" style="animation-delay:-6s"></div>
      <div class="grid-bg pointer-events-none absolute inset-0"></div>

      <div class="relative grid gap-12 p-8 sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:p-16">
        <!-- Copy -->
        <div>
          <span class="eyebrow">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400"></span>
            TechWeek · hasta 25% con cupones
          </span>

          <h1 class="mt-7 text-4xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            La tecnología que <span class="text-gradient">te adelanta</span>
          </h1>

          <p class="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Laptops, audio, wearables y gaming seleccionados por expertos.
            Envío rápido, garantía oficial y precios que sí tienen sentido.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/shop" class="btn-primary">
              Explorar tienda
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            <a href="/register" class="btn-secondary">Crear cuenta gratis</a>
          </div>

          <dl class="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-7">
            <div><dt class="text-2xl font-bold tracking-tight text-white">10k+</dt><dd class="mt-1 text-xs text-slate-500">Pedidos entregados</dd></div>
            <div><dt class="text-2xl font-bold tracking-tight text-white">4.9★</dt><dd class="mt-1 text-xs text-slate-500">Valoración media</dd></div>
            <div><dt class="text-2xl font-bold tracking-tight text-white">24h</dt><dd class="mt-1 text-xs text-slate-500">Despacho en capital</dd></div>
          </dl>
        </div>

        <!-- Bento de fotos reales -->
        <div class="relative hidden lg:block">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-4">
              ${heroShot('zephyr-14', 'Laptop Zephyr 14"', 'h-56')}
              ${heroShot('novabuds-pro', 'Auriculares NovaBuds Pro', 'h-40')}
            </div>
            <div class="space-y-4 pt-10">
              ${heroShot('pulse-x', 'Smartwatch Pulse X', 'h-40')}
              ${heroShot('skycam-mini', 'Drone SkyCam Mini', 'h-56')}
            </div>
          </div>

          <!-- Chips flotantes -->
          <div class="absolute -left-6 bottom-14 flex items-center gap-3 rounded-2xl border border-white/15 bg-ink-950/90 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
            <span class="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">${icons.truck}</span>
            <div class="text-xs leading-tight">
              <p class="font-semibold text-white">Envío en 24 h</p>
              <p class="text-slate-500">Gratis sobre $500</p>
            </div>
          </div>
          <div class="absolute -right-4 top-6 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3.5 py-2 text-xs font-semibold text-indigo-200 shadow-xl shadow-indigo-500/10 backdrop-blur">
            −15% · código FLASH25
          </div>
        </div>
      </div>
    </section>

    <!-- =========================== CATEGORÍAS =========================== -->
    <section class="mt-16">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-xl font-bold tracking-tight text-white">Compra por categoría</h2>
          <p class="mt-1 text-sm text-slate-500">Lo esencial, organizado.</p>
        </div>
        <a href="/shop" class="text-sm font-semibold text-indigo-400 transition hover:text-indigo-300">Ver todo →</a>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        ${CATEGORIES.map(
          (c) => `
          <a href="/shop?category=${encodeURIComponent(c.name)}"
             class="card group flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-sm transition hover:border-white/20 hover:bg-white/[0.05]">
            <span class="block text-sm font-semibold text-slate-100 transition group-hover:text-white">${escapeHtml(c.name)}</span>
          </a>`
        ).join('')}
      </div>
    </section>

    <!-- =========================== DESTACADOS =========================== -->
    <section class="mt-16">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-xl font-bold tracking-tight text-white">Destacados de la semana</h2>
          <p class="mt-1 text-sm text-slate-500">Selección del equipo de Zona Gadget.</p>
        </div>
        <a href="/shop" class="text-sm font-semibold text-indigo-400 transition hover:text-indigo-300">Ver todo →</a>
      </div>
      <div id="featured-grid" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        ${skeletonCards(4)}
      </div>
    </section>

    <!-- ======================== BANNER DE CUPÓN ========================= -->
    <section class="mt-16 overflow-hidden rounded-3xl border border-indigo-500/25 bg-gradient-to-r from-indigo-600/30 via-ink-900 to-cyan-600/20">
      <div class="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
        <div>
          <p class="eyebrow">Cupón de bienvenida</p>
          <h2 class="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            10% extra en tu primer pedido
          </h2>
          <p class="mt-2 max-w-md text-sm leading-6 text-slate-400">
            Actívalo en el carrito antes de finalizar la compra. Válido en todo el catálogo.
          </p>
        </div>
        <div class="rounded-2xl border border-dashed border-indigo-400/50 bg-ink-950/70 px-8 py-5 text-center shadow-inner">
          <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Código</p>
          <p class="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-white">WELCOME10</p>
        </div>
      </div>
    </section>

    <!-- ========================== VALUE PROPS =========================== -->
    <section class="mt-16 grid gap-4 sm:grid-cols-3">
      <div class="card p-6">
        <h3 class="text-sm font-semibold text-white">Envío express</h3>
        <p class="mt-1.5 text-sm leading-6 text-slate-500">Despacho en 24 h en Caracas y 48–72 h a regiones.</p>
      </div>
      <div class="card p-6">
        <h3 class="text-sm font-semibold text-white">Garantía oficial</h3>
        <p class="mt-1.5 text-sm leading-6 text-slate-500">Garantía distribuidor en todo el catálogo.</p>
      </div>
      <div class="card p-6">
        <h3 class="text-sm font-semibold text-white">Soporte real</h3>
        <p class="mt-1.5 text-sm leading-6 text-slate-500">Respuesta rápida de lunes a viernes.</p>
      </div>
    </section>
  `;

  // Carga diferida de destacados para no bloquear el primer paint.
  try {
    const { products } = await api('/products?featured=1');
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    grid.innerHTML = products.length
      ? products.slice(0, 4).map(productCard).join('')
      : `<p class="col-span-full text-sm text-slate-500">No hay productos destacados por el momento.</p>`;
  } catch (err) {
    console.error('No se pudieron cargar los destacados', err);
  }
}
