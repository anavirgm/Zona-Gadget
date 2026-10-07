/**
 * Componentes y helpers compartidos entre vistas.
 * Toda interpolación de datos de usuario/catálogo pasa por `escapeHtml`
 * antes de llegar al DOM.
 */

import { getUser, logout, cartCount, addToCart } from './store.js';
import { navigate } from './router.js';
import { icon } from './icons.js';

/* ------------------------------- Helpers ------------------------------- */

export const FREE_SHIPPING_CENTS = 9900;
const moneyFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function money(cents) {
  return `US$ ${moneyFormatter.format((cents || 0) / 100)}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str || '').length; i++) {
    h ^= String(str || '').charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function socialProof(product) {
  const h = hashString(product?.id || product?.slug || product?.name || '');
  const rating = 4.3 + (h % 7) / 10;
  const reviews = 24 + (h % 380);
  const sold = 50 + ((h >>> 8) % 950);
  return { rating: Math.round(rating * 10) / 10, reviews, sold };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ------------------------------- Toasts ------------------------------- */

export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  const colors = {
    success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100',
    error: 'border-rose-500/30 bg-rose-950/90 text-rose-100',
    info: 'border-indigo-500/30 bg-indigo-950/90 text-indigo-100',
  };

  const el = document.createElement('div');
  el.className = `pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${colors[type] || colors.info}`;
  el.setAttribute('role', 'status');
  el.textContent = message;

  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(12px)';
    setTimeout(() => el.remove(), 320);
  }, 3800);
}

/* ------------------------------ Navbar -------------------------------- */

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = cartCount();
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

/** Renderiza el bloque de sesión del navbar (entrar / mi cuenta / salir). */
export function renderNavAuth() {
  const container = document.getElementById('nav-auth');
  const user = getUser();

  if (!user) {
    container.innerHTML = `
      <a href="/login" class="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white sm:block">Iniciar sesión</a>
      <a href="/register" class="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-slate-200">Crear cuenta</a>
    `;
    return;
  }

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  const isAdmin = user.role === 'admin';

  container.innerHTML = `
    ${isAdmin ? '<a href="/admin" class="hidden rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20 sm:block">Admin</a>' : ''}
    <a href="/account" class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 transition hover:border-white/20" title="Mi cuenta">
      <span class="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-cyan-400 text-[11px] font-bold text-white">${escapeHtml(initial)}</span>
      <span class="hidden max-w-[110px] truncate text-sm font-medium text-slate-300 sm:block">${escapeHtml(user.displayName || user.email)}</span>
    </a>
    <button id="btn-logout" class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
      ${icon('LogOut', 'h-4 w-4')}
    </button>
  `;

  container.querySelector('#btn-logout')?.addEventListener('click', async () => {
    await logout();
    renderNavAuth();
    toast('Sesión cerrada', 'info');
    navigate('/');
  });
}

/* ------------------------------ Tarjetas ------------------------------- */

/**
 * Media del producto: foto real desde /assets/products/ con el icono emoji
 * como capa de respaldo (si la foto no existe o falla al cargar, queda el
 * emoji visible en lugar de un hueco).
 */
export function productMedia(product, { ratio = 'aspect-[4/3]', zoom = true } = {}) {
  const icon = escapeHtml(product.icon || '📦');
  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}"
            loading="lazy" decoding="async"
            class="relative z-10 h-full w-full object-contain p-4 ${zoom ? 'transition duration-500 ease-out group-hover:scale-[1.02]' : ''}"
            onerror="this.remove()" />`
    : '';

  return `
    <div class="${ratio} relative flex items-center justify-center overflow-hidden bg-white ring-1 ring-white/10">
      <span class="absolute inset-0 z-0 grid place-items-center text-6xl select-none opacity-60" aria-hidden="true">${icon}</span>
      ${image}
    </div>`;
}

const cardProducts = new Map();
let quickAddBound = false;

function bindQuickAdd() {
  if (quickAddBound || typeof document === 'undefined') return;
  quickAddBound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-quick-add]');
    if (!btn) return;
    event.preventDefault();
    const product = cardProducts.get(String(btn.dataset.quickAdd));
    if (!product) return;
    if (product.stock === 0) {
      toast('Producto sin stock', 'error');
      return;
    }
    addToCart(product, 1);
    updateCartBadge();
    toast(`${product.name} agregado al carrito`);
  });
}

export function productCard(product) {
  bindQuickAdd();
  cardProducts.set(String(product.id), product);

  const discount = product.compare_at_cents
    ? Math.round((1 - product.price_cents / product.compare_at_cents) * 100)
    : 0;
  const { rating, reviews, sold } = socialProof(product);
  const freeShipping = product.price_cents >= FREE_SHIPPING_CENTS;
  const installment = Math.round(product.price_cents / 6);

  return `
  <div class="card group relative flex flex-col">
    <a href="/product/${encodeURIComponent(product.id)}" class="flex flex-1 flex-col focus:outline-none" aria-label="${escapeHtml(product.name)}">
      <div class="relative">
        ${productMedia(product)}
        ${discount ? `<span class="absolute left-3 top-3 z-20 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg shadow-rose-500/30">−${discount}%</span>` : ''}
        <span class="absolute inset-x-0 bottom-0 z-20 translate-y-full bg-gradient-to-t from-black/70 to-transparent p-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white transition duration-300 group-hover:translate-y-0">Ver detalle</span>
      </div>
      <div class="flex flex-1 flex-col gap-1.5 p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-indigo-400/80">${escapeHtml(product.category || '')}</p>
        <h3 class="text-sm font-semibold leading-snug text-slate-100 line-clamp-2 transition group-hover:text-white">${escapeHtml(product.name)}</h3>
        <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
          ${stars(rating)}
          <span class="font-medium text-slate-300">${rating.toFixed(1)}</span>
          <span>(${reviews})</span>
          <span class="text-slate-600">·</span>
          <span>${sold} vendidos</span>
        </div>
        <div class="mt-auto flex items-baseline gap-2 pt-2">
          <span class="text-lg font-bold tracking-tight text-white">${money(product.price_cents)}</span>
          ${product.compare_at_cents ? `<span class="text-xs text-slate-500 line-through">${money(product.compare_at_cents)}</span>` : ''}
        </div>
        <p class="text-[11px] text-slate-400">6 cuotas de ${money(installment)} sin interés</p>
        ${freeShipping ? `<p class="flex items-center gap-1 text-[11px] font-medium text-emerald-400">${icon('Truck', 'h-3.5 w-3.5')} Envío gratis</p>` : ''}
      </div>
    </a>
    <button type="button" data-quick-add="${escapeHtml(product.id)}" class="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-ink-950/80 text-slate-300 backdrop-blur transition hover:border-indigo-400/60 hover:bg-indigo-500 hover:text-white active:scale-95" title="Agregar al carrito" aria-label="Agregar ${escapeHtml(product.name)} al carrito">
      ${icon('Plus', 'h-4 w-4', 2.2)}
    </button>
  </div>
  `;
}

export function skeletonCards(count = 8) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="card overflow-hidden">
        <div class="skeleton aspect-[4/3] w-full"></div>
        <div class="space-y-2.5 p-4">
          <div class="skeleton h-3 w-1/3 rounded"></div>
          <div class="skeleton h-4 w-4/5 rounded"></div>
          <div class="skeleton h-5 w-1/2 rounded"></div>
        </div>
      </div>
    `
    )
    .join('');
}

export function emptyState({ title, description, ctaHref, ctaLabel }) {
  return `
    <div class="mx-auto max-w-md rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
      <span class="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
        ${icon('Package', 'h-6 w-6')}
      </span>
      <h2 class="text-lg font-semibold text-white">${escapeHtml(title)}</h2>
      <p class="mt-2 text-sm leading-6 text-slate-500">${escapeHtml(description)}</p>
      ${ctaHref ? `<a href="${escapeHtml(ctaHref)}" class="btn-primary mt-6 inline-flex">${escapeHtml(ctaLabel)}</a>` : ''}
    </div>
  `;
}

export function statusChip(status) {
  const map = {
    pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    shipped: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    failed: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  };
  const label = { pending: 'Pendiente', paid: 'Pagado', shipped: 'Enviado', cancelled: 'Cancelado', failed: 'Fallido' };
  return `<span class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${map[status] || map.pending}">${label[status] || escapeHtml(status)}</span>`;
}

/* -------------------------------- Iconos --------------------------------
 * SVG inline de trazo fino (estilo Lucide) para no depender de emoji
 * ni de librerías de iconos externas. Uso: `${icons.truck}`.
 */
const svg = (paths, extra = '') =>
  `<svg class="h-${extra || '5'} w-${extra || '5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  truck: svg('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
  shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  support: svg('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
  returns: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  zap: svg('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'),
  lock: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  box: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.3 7.5L12 12.5l8.7-5"/><path d="M12 22.5V12.5"/>'),
  heart: svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
};

/** Estrellas de valoración (siempre 5, con la última parcial según rating). */
export function stars(rating = 5) {
  const full = Math.round(rating);
  return `<span class="inline-flex items-center gap-0.5 text-amber-400" aria-label="${rating} de 5 estrellas">
    ${Array.from({ length: 5 }, (_, i) =>
      `<svg class="h-3.5 w-3.5 ${i < full ? 'text-amber-400' : 'text-slate-700'}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    ).join('')}
  </span>`;
}
