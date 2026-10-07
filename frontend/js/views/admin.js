/**
 * Vista: panel de administración (/admin) — requiere rol `admin`.
 */

import { api } from '../api.js';
import { money, escapeHtml, toast, statusChip, timeAgo } from '../components.js';
import { getUser } from '../store.js';
import { navigate } from '../router.js';

const ROLE_LABEL = { customer: 'Cliente', admin: 'Admin' };

function usersTable(users) {
  return `
    <div class="overflow-x-auto rounded-2xl border border-white/10">
      <table class="w-full min-w-[560px] text-left text-sm">
        <thead class="bg-white/5 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3 font-semibold">Usuario</th>
            <th class="px-4 py-3 font-semibold">Rol</th>
            <th class="px-4 py-3 font-semibold">Verificado</th>
            <th class="px-4 py-3 font-semibold">Registro</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          ${users
            .map(
              (u) => `
            <tr class="transition hover:bg-white/[0.03]">
              <td class="px-4 py-3">
                <p class="font-medium text-white">${escapeHtml(u.displayName || '—')}</p>
                <p class="text-xs text-slate-500">${escapeHtml(u.email || '')}</p>
              </td>
              <td class="px-4 py-3">
                <span class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  u.role === 'admin'
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/15 bg-white/5 text-slate-400'
                }">${ROLE_LABEL[u.role] || escapeHtml(u.role)}</span>
              </td>
              <td class="px-4 py-3 text-slate-400">${u.isVerified ? 'Sí' : 'No'}</td>
              <td class="px-4 py-3 text-xs text-slate-500">${timeAgo(u.createdAt)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function ordersTable(orders) {
  return `
    <div class="overflow-x-auto rounded-2xl border border-white/10">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead class="bg-white/5 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3 font-semibold">Pedido</th>
            <th class="px-4 py-3 font-semibold">Usuario</th>
            <th class="px-4 py-3 font-semibold">Estado</th>
            <th class="px-4 py-3 font-semibold">Descuento</th>
            <th class="px-4 py-3 font-semibold">Total</th>
            <th class="px-4 py-3 font-semibold">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          ${orders
            .map(
              (o) => `
            <tr class="transition hover:bg-white/[0.03]">
              <td class="px-4 py-3 font-mono text-xs text-slate-300">${escapeHtml(o.id.slice(0, 8))}</td>
              <td class="px-4 py-3 font-mono text-xs text-slate-500">${escapeHtml(o.user_id.slice(0, 8))}…</td>
              <td class="px-4 py-3">${statusChip(o.status)}</td>
              <td class="px-4 py-3 text-slate-400">${money(o.discount_cents)}</td>
              <td class="px-4 py-3 font-semibold text-white">${money(o.total_cents)}</td>
              <td class="px-4 py-3 text-xs text-slate-500">${timeAgo(o.created_at)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export async function render() {
  document.title = 'Administración · Zona Gadget';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-indigo-400">Backoffice</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight text-white">Administración</h1>
        <p class="mt-2 text-sm text-slate-500">Usuarios y pedidos de la plataforma.</p>
      </div>
      <a href="/" class="btn-secondary !py-2.5">← Volver a la tienda</a>
    </div>
    <div class="space-y-10">
      <section>
        <h2 class="mb-4 text-sm font-semibold text-white">Usuarios</h2>
        <div class="skeleton h-48 rounded-2xl border border-white/10"></div>
      </section>
      <section>
        <h2 class="mb-4 text-sm font-semibold text-white">Pedidos recientes</h2>
        <div class="skeleton h-48 rounded-2xl border border-white/10"></div>
      </section>
    </div>
  `;

  // Guard en cliente: si ni siquiera hay sesión, ni vamos a gastar un round-trip.
  // La autorización real la aplica requireRole en el backend.
  if (!getUser()) {
    navigate('/login?next=/admin', { replace: true });
    return;
  }

  try {
    const [{ users }, { orders }] = await Promise.all([
      api('/admin/users'),
      api('/admin/orders'),
    ]);

    const firstSection = app.querySelectorAll('section')[0];
    const secondSection = app.querySelectorAll('section')[1];

    firstSection.innerHTML = `
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-white">Usuarios <span class="ml-1 text-xs font-normal text-slate-500">(${users.length})</span></h2>
      </div>
      ${usersTable(users)}
    `;

    secondSection.innerHTML = `
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-white">Pedidos recientes <span class="ml-1 text-xs font-normal text-slate-500">(${orders.length})</span></h2>
      </div>
      ${orders.length ? ordersTable(orders) : '<p class="text-sm text-slate-500">Sin pedidos registrados.</p>'}
    `;
  } catch (err) {
    if (err.status === 401) {
      navigate('/login?next=/admin', { replace: true });
      return;
    }

    if (err.status === 403) {
      app.innerHTML = `
        <div class="mx-auto max-w-md rounded-3xl border border-white/10 bg-ink-900 px-8 py-16 text-center">
          <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
            <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <h1 class="mt-5 text-2xl font-bold tracking-tight text-white">403 · Acceso restringido</h1>
          <p class="mt-2 text-sm leading-6 text-slate-500">Tu cuenta no tiene el rol necesario para entrar al backoffice.</p>
          <a href="/" class="btn-primary mt-8 inline-flex">Volver al inicio</a>
        </div>`;
      document.title = '403 · Zona Gadget';
      return;
    }

    toast('No se pudo cargar el panel', 'error');
  }
}
