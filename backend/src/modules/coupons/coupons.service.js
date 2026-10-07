'use strict';

/**
 * Servicio de cupones de descuento.
 *
 * Modelo: cada cupón es de un solo uso (`coupons.used_at`). Al aplicarlo se
 * emite una fila en `coupon_redemptions` (trazabilidad del descuento) y el
 * cupón queda marcado como canjeado para usos futuros.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { ApiError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * Aplica un cupón de un solo uso a la cuenta del usuario.
 *
 * Secuencia: se valida el estado vigente del cupón (existencia, vigencia y
 * que no haya sido canjeado), se deja constancia del canje en el registro de
 * auditoría y finalmente se marca el cupón como usado. Postgres serializa las
 * escrituras a nivel de fila, por lo que esta secuencia secuencial resulta
 * suficiente para el volumen actual sin necesidad de transacciones explícitas.
 */
async function applyCoupon(userId, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('El código del cupón es obligatorio');

  // 1) Estado actual del cupón.
  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('id, code, discount_pct, description, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  if (error) throw ApiError.internal('No fue posible consultar el cupón');
  if (!coupon) throw ApiError.notFound('El cupón no existe');

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    throw ApiError.badRequest('El cupón ha expirado');
  }

  if (coupon.used_at) {
    throw ApiError.conflict('El cupón ya fue canjeado');
  }

  // 2) Auditoría del canje (append-only) antes de mutar el cupón.
  const { data: redemption, error: insertError } = await supabaseAdmin
    .from('coupon_redemptions')
    .insert({
      coupon_id: coupon.id,
      user_id: userId,
      discount_pct: coupon.discount_pct,
    })
    .select('id, coupon_id, discount_pct, created_at')
    .single();

  if (insertError) {
    logger.error('No se pudo registrar la redención', { code, error: insertError.message });
    throw ApiError.internal('No fue posible aplicar el cupón');
  }

  // 3) Marcar el cupón como canjeado.
  await supabaseAdmin.from('coupons').update({ used_at: new Date().toISOString() }).eq('id', coupon.id);

  logger.info('Cupón aplicado', { code, userId, redemptionId: redemption.id });

  return {
    redemption,
    coupon: {
      code: coupon.code,
      discount_pct: coupon.discount_pct,
      description: coupon.description,
    },
  };
}

/** Redenciones activas (sin ligar a orden) del usuario — las usa el checkout. */
async function listMyRedemptions(userId) {
  const { data, error } = await supabaseAdmin
    .from('coupon_redemptions')
    .select('id, coupon_id, discount_pct, created_at, order_id, coupons(code, description)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw ApiError.internal('No fue posible consultar tus cupones');
  return data || [];
}

module.exports = { applyCoupon, listMyRedemptions };
