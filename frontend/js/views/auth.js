/**
 * Vistas: /login y /register
 */

import { api, ApiError, auth } from '../api.js';
import { setUser } from '../store.js';
import { toast, escapeHtml, renderNavAuth, updateCartBadge } from '../components.js';
import { navigate } from '../router.js';

function shell({ title, subtitle, fields, submitLabel, footerHtml }) {
  return `
    <div class="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-10">
      <div class="blob -top-10 -left-16 h-48 w-48 bg-indigo-600/30"></div>
      <div class="rounded-3xl border border-white/10 bg-ink-900 p-8 shadow-2xl shadow-black/50">
        <div class="mb-7 text-center">
          <img src="/assets/img/isotipo.jpg" alt="Zona Gadget" class="mx-auto h-12 w-12 rounded-2xl object-cover ring-1 ring-white/20 shadow-lg shadow-indigo-500/20" />
          <h1 class="mt-4 text-2xl font-bold tracking-tight text-white">${escapeHtml(title)}</h1>
          <p class="mt-1.5 text-sm text-slate-500">${escapeHtml(subtitle)}</p>
        </div>

        <form id="auth-form" class="space-y-4" novalidate>
          ${fields}
          <button type="submit" id="auth-submit"
                  class="btn-primary mt-2 w-full">
            ${escapeHtml(submitLabel)}
          </button>
        </form>

        <div class="mt-6 text-center text-sm text-slate-500">${footerHtml}</div>
      </div>
    </div>
  `;
}

function field({ id, label, type = 'text', placeholder, autocomplete, required = true, minLength }) {
  return `
    <label class="block">
      <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">${escapeHtml(label)}</span>
      <input id="${id}" name="${id}" type="${type}" placeholder="${escapeHtml(placeholder || '')}"
             autocomplete="${autocomplete}" ${required ? 'required' : ''} ${minLength ? `minlength="${minLength}"` : ''}
             class="input" />
    </label>
  `;
}

function nextPath() {
  return new URLSearchParams(window.location.search).get('next') || '/';
}

async function submitAuth({ endpoint, buildBody, button }) {
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Un momento…';

  try {
    const payload = await api(endpoint, { method: 'POST', body: buildBody() });

    if (payload.requiresEmailConfirmation) {
      toast('Revisa tu correo para confirmar la cuenta', 'info');
      navigate('/login');
      return;
    }

    auth.set(payload.token);
    setUser(payload.user);
    await renderNavAuth();
    updateCartBadge();
    toast(`Bienvenido, ${payload.user.displayName || payload.user.email}`);
    navigate(nextPath());
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Error de conexión', 'error');
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function renderLogin() {
  document.title = 'Iniciar sesión · Zona Gadget';

  const app = document.getElementById('app');
  app.innerHTML = shell({
    title: 'Bienvenido de nuevo',
    subtitle: 'Ingresa para ver tus pedidos y cupones.',
    submitLabel: 'Iniciar sesión',
    fields: [
      field({ id: 'email', label: 'Correo', type: 'email', placeholder: 'tu@correo.com', autocomplete: 'email' }),
      field({ id: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' }),
    ].join(''),
    footerHtml: `¿No tienes cuenta? <a href="/register?next=${encodeURIComponent(nextPath())}" class="font-semibold text-indigo-400 hover:text-indigo-300">Créala gratis</a>`,
  });

  app.querySelector('#auth-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth({
      endpoint: '/auth/login',
      button: app.querySelector('#auth-submit'),
      buildBody: () => ({
        email: app.querySelector('#email').value.trim(),
        password: app.querySelector('#password').value,
      }),
    });
  });

  app.querySelector('#email').focus();
}

export async function renderRegister() {
  document.title = 'Crear cuenta · Zona Gadget';

  const app = document.getElementById('app');
  app.innerHTML = shell({
    title: 'Crea tu cuenta',
    subtitle: 'Solo te toma un minuto. Sin tarjetas, sin compromisos.',
    submitLabel: 'Crear cuenta',
    fields: [
      field({ id: 'displayName', label: 'Nombre', placeholder: 'Cómo te llamamos', autocomplete: 'name', minLength: 2 }),
      field({ id: 'email', label: 'Correo', type: 'email', placeholder: 'tu@correo.com', autocomplete: 'email' }),
      field({ id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 8 caracteres', autocomplete: 'new-password', minLength: 8 }),
    ].join(''),
    footerHtml: `¿Ya tienes cuenta? <a href="/login?next=${encodeURIComponent(nextPath())}" class="font-semibold text-indigo-400 hover:text-indigo-300">Ingresa aquí</a>`,
  });

  app.querySelector('#auth-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth({
      endpoint: '/auth/register',
      button: app.querySelector('#auth-submit'),
      buildBody: () => ({
        displayName: app.querySelector('#displayName').value.trim(),
        email: app.querySelector('#email').value.trim(),
        password: app.querySelector('#password').value,
      }),
    });
  });

  app.querySelector('#displayName').focus();
}
