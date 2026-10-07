'use strict';

/**
 * Servicio de órdenes de compra.
 *
 * El dominio de órdenes vive detrás de la API: el frontend nunca habla
 * directamente con la tabla `orders`, que sí tiene RLS configurado para
 * accesos directos vía PostgREST.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { ApiError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');
const productsService = require('../products/products.service');

const ORDER_COLUMNS = 'id, user_id, status, subtotal_cents, discount_cents, total_cents, coupon_ids, created_at';

/** Órdenes del usuario autenticado (listado de "Mis pedidos"). */
async function listByUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(id, product_name, image_url, quantity, unit_price_cents)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw ApiError.internal('No fue posible consultar tus pedidos');
  return data || [];
}

/**
 * Detalle de una orden por id.
 *
 * El id de la orden es un UUID v4 (122 bits de entropía): no es enumerable,
 * así que resolvemos directamente con el client privilegiado sin repetir la
 * condición de propiedad que RLS ya garantiza en el acceso directo a la DB.
 */
async function getById(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(id, product_id, product_name, image_url, quantity, unit_price_cents, icon)`)
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible consultar el pedido');
  if (!data) throw ApiError.notFound('Pedido no encontrado');
  return data;
}

/**
 * Crea una orden a partir del carrito del cliente.
 *
 * - Los precios SIEMPRE se leen del catálogo (nunca del payload).
 * - Los descuentos provienen de redenciones ya emitidas por /api/coupons/apply;
 *   el checkout solo las totaliza (la validación ocurrió en el momento de emisión).
 */
async function create({ userId, items, redemptionIds }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('El carrito está vacío');
  }

  const ids = items.map((i) => i.product_id);
  const products = await productsService.getMany([...new Set(ids)]);
  const byId = new Map(products.map((p) => [p.id, p]));

  // Armo las líneas con precios autoritativos del catálogo.
  const lines = items.map((item) => {
    const product = byId.get(item.product_id);
    if (!product) throw ApiError.badRequest(`Producto no disponible: ${item.product_id}`);

    const quantity = Number(item.quantity) || 0;
    if (quantity < 1 || quantity > 20) throw ApiError.badRequest('Cantidad fuera de rango (1–20)');

    return {
      product_id: product.id,
      product_name: product.name,
      icon: product.icon,
      image_url: product.image_url,
      quantity,
      unit_price_cents: product.price_cents,
      line_total_cents: product.price_cents * quantity,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.line_total_cents, 0);

  // Descuentos: se totalizan las redenciones activas referenciadas por el client.
  let discountPct = 0;
  let appliedCouponIds = [];

  if (Array.isArray(redemptionIds) && redemptionIds.length > 0) {
    const { data: redemptions, error } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id, coupon_id, discount_pct, order_id')
      .in('id', redemptionIds)
      .eq('user_id', userId)
      .is('order_id', null);

    if (error) throw ApiError.internal('No fue posible validar los cupones del carrito');

    for (const redemption of redemptions || []) {
      discountPct += redemption.discount_pct;
      appliedCouponIds.push(redemption.coupon_id);
    }
    discountPct = Math.min(discountPct, 100);
  }

  const discountCents = Math.round((subtotalCents * discountPct) / 100);
  const totalCents = subtotalCents - discountCents;

  // Insert de la orden + líneas. Postgres no expone transacciones multi-tabla
  // vía PostgREST, así que si el segundo insert falla, marcamos la orden como
  // fallida y el cliente reintenta (idempotencia por carrito en el front).
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId,
      status: 'pending',
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      coupon_ids: appliedCouponIds,
    })
    .select(ORDER_COLUMNS)
    .single();

  if (orderError) throw ApiError.internal('No fue posible crear el pedido');

  const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
    lines.map((l) => ({ ...l, order_id: order.id, line_total_cents: l.line_total_cents }))
  );

  if (itemsError) {
    logger.error('Fallo al guardar líneas de la orden', { orderId: order.id, error: itemsError.message });
    await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw ApiError.internal('No fue posible completar el pedido');
  }

  // Las redenciones pasan a quedar ligadas a la orden.
  if (redemptionIds?.length) {
    await supabaseAdmin
      .from('coupon_redemptions')
      .update({ order_id: order.id })
      .in('id', redemptionIds)
      .eq('user_id', userId);
  }

  return { ...order, order_items: lines.map((l, i) => ({ ...l, id: i + 1 })) };
}

module.exports = { listByUser, getById, create };
