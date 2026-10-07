/**
 * Vista: mi cuenta (/account)
 *
 * Esta vista es server-rendered: el backend inyecta el estado del usuario en
 * `window.__INITIAL_STATE__` (ver backend/src/ssr/index.js) para hidratar sin
 * round-trip a la red. Si el estado no está (navegación interna del SPA),
 * caemos a GET /api/users/me como cualquier otra vista.
 */

import { api } from '../api.js';
import { getUser, setUser } from '../store.js';
import { money, escapeHtml, toast, statusChip, timeAgo, emptyState, renderNavAuth } from '../components.js';
import { navigate } from '../router.js';

const initialState = window.__INITIAL_STATE__ || null;

async function resolveUser() {
  if (initialState?.user) return initialState.user;

  try {
    const { user } = await api('/users/me');
    setUser(user);
    return user;
  } catch (err) {
    if (err.status === 401) {
      navigate('/login?next=/account', { replace: true });
      return null;
    }
    throw err;
  }
}

function profileHeader(user) {
  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : 'Cliente';
  const roleClass =
    user.role === 'admin'
      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
      : 'border-white/15 bg-white/5 text-slate-400';

  return `
    <div class="flex items-center gap-4">
      <span class="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-2xl font-black text-white shadow-xl shadow-indigo-500/20">${escapeHtml(initial)}</span>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-xl font-bold text-white">${escapeHtml(user.displayName || 'Sin nombre')}</h1>
          <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleClass}">${roleLabel}</span>
          ${user.isVerified ? '<span class="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">✓ Verificado</span>' : ''}
        </div>
        <p class="mt-1 truncate text-sm text-slate-500">${escapeHtml(user.email || '')}</p>
        <p class="mt-0.5 text-xs text-slate-600">Miembro desde ${timeAgo(user.createdAt)}</p>
      </div>
    </div>
  `;
}

export async function render() {
  document.title = 'Mi cuenta · Zona Gadget';

  const user = await resolveUser();
  if (!user) return;

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Panel izquierdo -->
      <aside class="space-y-6">
        <div class="rounded-2xl border border-white/10 bg-ink-900 p-6">${profileHeader(user)}</div>

        <nav class="rounded-2xl border border-white/10 bg-ink-900 p-2 text-sm">
          <span class="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 font-semibold text-white">Mi perfil</span>
          <span class="mt-1 flex items-center justify-between px-4 py-2.5 text-slate-500">Direcciones <span class="text-xs">próximamente</span></span>
          <span class="flex items-center justify-between px-4 py-2.5 text-slate-500">Métodos de pago <span class="text-xs">próximamente</span></span>
        </nav>
      </aside>

      <!-- Columna principal -->
      <div class="space-y-8 lg:col-span-2">
        <!-- Editar perfil -->
        <section class="rounded-2xl border border-white/10 bg-ink-900 p-6">
          <h2 class="text-sm font-semibold text-white">Editar perfil</h2>
          <p class="mt-1 text-xs text-slate-500">Los cambios se reflejan en tus reseñas y pedidos.</p>

          <form id="profile-form" class="mt-5 space-y-4">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</span>
              <input id="p-display-name" type="text" value="${escapeHtml(user.displayName || '')}" maxlength="80"
                     class="input" />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Bio</span>
              <textarea id="p-bio" rows="3" maxlength="280" placeholder="Cuéntanos un poco de ti…"
                        class="input resize-none">${escapeHtml(user.bio || '')}</textarea>
              <span class="mt-1 block text-[11px] text-slate-600">Máximo 280 caracteres.</span>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">URL de avatar</span>
              <input id="p-avatar" type="text" value="${escapeHtml(user.avatarUrl || '')}" placeholder="https://…"
                     class="input" />
            </label>

            <button type="submit" id="p-save"
                    class="btn-primary !px-5 !py-2.5 disabled:opacity-50">
              Guardar cambios
            </button>
          </form>
        </section>

        <!-- Mis pedidos -->
        <section class="rounded-2xl border border-white/10 bg-ink-900 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-white">Mis pedidos</h2>
            <a href="/shop" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300">Seguir comprando →</a>
          </div>
          <div id="orders" class="mt-4 space-y-3">
            <div class="skeleton h-20 rounded-xl"></div>
            <div class="skeleton h-20 rounded-xl"></div>
          </div>
        </section>
      </div>
    </div>
  `;

  /* ----------------------- Editar perfil ----------------------- */
  app.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = app.querySelector('#p-save');
    button.disabled = true;
    button.textContent = 'Guardando…';

    try {
      const { user: updated } = await api('/users/profile', {
        method: 'PUT',
        body: {
          display_name: app.querySelector('#p-display-name').value.trim(),
          bio: app.querySelector('#p-bio').value.trim(),
          avatar_url: app.querySelector('#p-avatar').value.trim(),
        },
      });

      setUser(updated);
      // Sincronizamos el estado SSR y la navbar (rol, nombre, avatar).
      if (initialState?.user) initialState.user = updated;
      renderNavAuth();
      toast('Perfil actualizado');
      render(); // re-render con los datos frescos (incluye badges de rol)
    } catch (err) {
      toast(err.message || 'No se pudo guardar', 'error');
      button.disabled = false;
      button.textContent = 'Guardar cambios';
    }
  });

  /* ------------------------ Mis pedidos ------------------------ */
  try {
    const { orders } = await api('/orders');
    const container = app.querySelector('#orders');
    if (!container) return;

    container.innerHTML = orders.length
      ? orders
          .map(
            (order) => `
        <article class="rounded-xl border border-white/10 bg-ink-950/60 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Pedido ${escapeHtml(order.id.slice(0, 8))}</p>
              <p class="mt-1 text-xs text-slate-600">${timeAgo(order.created_at)} · ${(order.order_items || []).length} artículos</p>
            </div>
            <div class="flex items-center gap-3">
              ${statusChip(order.status)}
              <span class="text-sm font-bold text-white">${money(order.total_cents)}</span>
            </div>
          </div>
          <ul class="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            ${(order.order_items || [])
              .map(
                (li) => `
              <li class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-slate-400">
                ${li.image_url ? `<img src="${escapeHtml(li.image_url)}" alt="" class="h-6 w-6 rounded-md object-cover" onerror="this.remove()" />` : ''}
                ${escapeHtml(li.product_name)} × ${li.quantity}
              </li>`
              )
              .join('')}
          </ul>
        </article>`
          )
          .join('')
      : emptyState({
          title: 'Aún no tienes pedidos',
          description: 'Cuando compres algo, aparecerá aquí con su seguimiento.',
          ctaHref: '/shop',
          ctaLabel: 'Explorar tienda',
        });
  } catch (err) {
    console.error('No se pudieron cargar los pedidos', err);
    const container = app.querySelector('#orders');
    if (container) container.innerHTML = '<p class="text-sm text-slate-500">No pudimos cargar tus pedidos.</p>';
  }
}
