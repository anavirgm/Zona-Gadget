/**
 * Router SPA con History API.
 *
 * Cada módulo de vista exporta una función asíncrona que renderiza dentro de
 * #app. El router intercepta los clicks en enlaces internos para evitar
 * recargas completas del documento (salvo las rutas server-rendered).
 */

const routes = [
  { pattern: /^\/$/, view: () => import('./views/home.js').then((m) => m.render()) },
  { pattern: /^\/shop\/?$/, view: () => import('./views/shop.js').then((m) => m.render()) },
  { pattern: /^\/product\/([^/]+)$/, view: (ctx) => import('./views/product.js').then((m) => m.render(ctx.params[1])) },
  { pattern: /^\/cart\/?$/, view: () => import('./views/cart.js').then((m) => m.render()) },
  { pattern: /^\/login\/?$/, view: () => import('./views/auth.js').then((m) => m.renderLogin()) },
  { pattern: /^\/register\/?$/, view: () => import('./views/auth.js').then((m) => m.renderRegister()) },
  { pattern: /^\/account\/?$/, view: () => import('./views/account.js').then((m) => m.render()) },
  { pattern: /^\/admin\/?$/, view: () => import('./views/admin.js').then((m) => m.render()) },
];

const app = () => document.getElementById('app');

/** Navega a otra ruta del SPA. */
export function navigate(url, { replace = false } = {}) {
  const target = new URL(url, window.location.origin);
  if (replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  render();
}

function matchRoute(pathname) {
  for (const route of routes) {
    const params = route.pattern.exec(pathname);
    if (params) return { route, params };
  }
  return null;
}

export async function render() {
  const { pathname, search } = window.location;
  const matched = matchRoute(pathname);
  const container = app();

  highlightNav(pathname);

  if (!matched) {
    container.innerHTML = `
      <div class="mx-auto max-w-md py-24 text-center">
        <span class="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.33c-.6.24-.9.83-.9 1.47v.2"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>
        </span>
        <h1 class="mt-6 text-3xl font-bold tracking-tight text-white">404</h1>
        <p class="mt-2 text-sm text-slate-500">Esta página se fue al espacio.</p>
        <a href="/" class="btn-primary mt-8 inline-flex">Volver al inicio</a>
      </div>`;
    document.title = '404 · Zona Gadget';
    return;
  }

  try {
    await matched.route.view({ params: matched.params, search: new URLSearchParams(search) });
    container.classList.remove('view-enter');
    void container.offsetWidth; // reinicia la animación de entrada
    container.classList.add('view-enter');
    container.scrollIntoView({ block: 'start' });
  } catch (err) {
    console.error('Error al renderizar la vista', err);
    container.innerHTML = `
      <div class="mx-auto max-w-md py-24 text-center">
        <span class="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-300">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        </span>
        <h1 class="mt-6 text-2xl font-bold tracking-tight text-white">Algo salió mal</h1>
        <p class="mt-2 text-sm text-slate-500">${err.message || 'Error inesperado'}</p>
        <a href="/" class="btn-primary mt-8 inline-flex">Volver al inicio</a>
      </div>`;
  }
}

/** Marca el link activo del navbar según la ruta actual. */
function highlightNav(pathname) {
  const links = document.querySelectorAll('#main-nav a[data-nav]');
  links.forEach((link) => {
    const target = link.dataset.nav;
    const active =
      (target === '/' && pathname === '/') ||
      (target !== '/' && pathname.startsWith(target));
    link.classList.toggle('nav-active', active);
  });
}

/** Intercepta enlaces internos del shell (nav, footer, tarjetas). */
function setupLinkInterception() {
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('data-external')) return;
    if (!href.startsWith('/') || href.startsWith('//')) return;

    event.preventDefault();
    navigate(href);
  });
}

export function setupRouter() {
  window.addEventListener('popstate', () => render());
  setupLinkInterception();
}
