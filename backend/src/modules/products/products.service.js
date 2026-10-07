'use strict';

/**
 * Servicio de catálogo de productos.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { ApiError } = require('../../utils/errors');

const CATALOG_COLUMNS =
  'id, slug, name, description, category, price_cents, compare_at_cents, stock, icon, image_url, accent, is_active, is_featured, created_at';

/**
 * Listado público con filtros livianos (?category= & q= & featured=1).
 * Se usa `eq/is_active` + ilike; los parámetros viajan como bindings del
 * client de Supabase (se escapan automáticamente).
 */
async function list({ category, q, featured } = {}) {
  let query = supabaseAdmin
    .from('products')
    .select(CATALOG_COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(60);

  if (category) query = query.eq('category', category);
  if (featured === '1' || featured === true) query = query.eq('is_featured', true);
  // Búsqueda por nombre: el patrón viaja como binding del client (no como
  // parte de la sintaxis del filtro), así que no hay superficie de inyección.
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) throw ApiError.internal('No fue posible consultar el catálogo');
  return data || [];
}

async function getById(id) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(CATALOG_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible consultar el producto');
  if (!data) throw ApiError.notFound('Producto no encontrado');
  return data;
}

/** Devuelve los productos activos para una lista de ids (checkout). */
async function getMany(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, slug, name, price_cents, icon, image_url, stock, is_active')
    .in('id', ids)
    .eq('is_active', true);

  if (error) throw ApiError.internal('No fue posible resolver los productos del carrito');
  return data || [];
}

module.exports = { list, getById, getMany };
