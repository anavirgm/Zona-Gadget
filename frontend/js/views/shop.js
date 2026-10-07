/**
 * Vista: catálogo (/shop?category=…&q=…)
 */

import { api } from '../api.js';
import { escapeHtml, productCard, skeletonCards, emptyState } from '../components.js';
import { navigate } from '../router.js';

const FILTERS = ['Todos', 'Celulares', 'Laptops', 'Audio', 'Gaming', 'Wearables', 'Drones', 'Periféricos', 'Monitores', 'Tablets', 'Fotografía'];

export async function render(ctx = {}) {
  document.title = 'Tienda · Zona Gadget';

  const params = ctx.search instanceof URLSearchParams ? ctx.search : new URLSearchParams(window.location.search);
  const activeCategory = params.get('category') || '';
  const query = params.get('q') || '';

  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="mb-8">
      <p class="eyebrow">Catálogo</p>
      <h1 class="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Equipos y gadgets</h1>
      <p class="mt-2 text-sm text-slate-500">Todo verificado con garantía oficial y despacho rápido.</p>

      <!-- Búsqueda -->
      <form id="search-form" class="mt-6 flex max-w-lg gap-2">
        <div class="relative flex-1">
          <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="search-input" type="search" value="${escapeHtml(query)}" placeholder="Buscar productos…"
                 class="input pl-10" />
        </div>
        <button type="submit" class="btn-primary !px-5">Buscar</button>
      </form>

      <!-- Filtros de categoría -->
      <div class="mt-5 flex flex-wrap gap-2" id="category-filters">
        ${FILTERS.map((name) => {
          const value = name === 'Todos' ? '' : name;
          const active = value === activeCategory;
          return `<button data-category="${escapeHtml(value)}"
            class="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-lg shadow-indigo-500/10'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-white'
            }">${escapeHtml(name)}</button>`;
        }).join('')}
      </div>
    </header>

    <div class="mb-4 flex items-center justify-between text-xs text-slate-500">
      <span id="results-count"></span>
      <span class="hidden sm:block">Precios en USD · IVA incluido</span>
    </div>

    <div id="results" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">${skeletonCards(8)}</div>
  `;

  // Cambio de categoría → nueva URL (el router re-renderiza).
  app.querySelectorAll('#category-filters button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.category;
      const next = new URLSearchParams();
      if (value) next.set('category', value);
      if (query) next.set('q', query);
      navigate(`/shop${next.toString() ? `?${next}` : ''}`);
    });
  });

  // Búsqueda.
  app.querySelector('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const q = app.querySelector('#search-input').value.trim();
    const next = new URLSearchParams();
    if (activeCategory) next.set('category', activeCategory);
    if (q) next.set('q', q);
    navigate(`/shop${next.toString() ? `?${next}` : ''}`);
  });

  // Resultados desde la API.
  const query2 = new URLSearchParams();
  if (activeCategory) query2.set('category', activeCategory);
  if (query) query2.set('q', query);

  try {
    const { products } = await api(`/products?${query2.toString()}`);
    const container = document.getElementById('results');
    if (!container) return;

    container.innerHTML = products.length
      ? products.map(productCard).join('')
      : `<div class="col-span-full">${emptyState({
          title: 'Sin resultados',
          description: 'No encontramos productos que coincidan con tu búsqueda.',
          ctaHref: '/shop',
          ctaLabel: 'Ver todo el catálogo',
        })}</div>`;

    const count = document.getElementById('results-count');
    if (count) count.textContent = `${products.length} producto${products.length === 1 ? '' : 's'}`;
  } catch (err) {
    console.error('Error cargando catálogo', err);
  }
}
