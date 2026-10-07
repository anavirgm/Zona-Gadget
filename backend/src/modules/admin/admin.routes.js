'use strict';

/**
 * Panel de administración (solo rol `admin`).
 *
 * Protegido por `requireRole('admin')`: el rol se resuelve desde la fila de
 * `profiles` asociada a la sesión del request.
 */

const express = require('express');
const Joi = require('joi');
const { authenticate, requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { supabaseAdmin } = require('../../config/supabase');
const { ApiError } = require('../../utils/errors');
const { serializeProfile } = require('../../utils/serialize');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

/** Listado de usuarios para revisión interna. */
router.get('/users', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw ApiError.internal('No fue posible listar usuarios');
    res.json({ users: (data || []).map(serializeProfile) });
  } catch (err) {
    next(err);
  }
});

/** Órdenes globales (backoffice). */
router.get('/orders', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status, total_cents, discount_cents, created_at, order_items(product_name, quantity)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw ApiError.internal('No fue posible listar pedidos');
    res.json({ orders: data || [] });
  } catch (err) {
    next(err);
  }
});

const createCouponSchema = Joi.object({
  code: Joi.string().min(3).max(40).required(),
  discount_pct: Joi.number().integer().min(1).max(100).required(),
  description: Joi.string().max(120).allow('').optional(),
  expires_at: Joi.date().iso().optional(),
}).unknown(true);

/** Alta de cupones. */
router.post('/coupons', validate(createCouponSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert({
        code: String(req.body.code).toUpperCase(),
        discount_pct: req.body.discount_pct,
        description: req.body.description || '',
        expires_at: req.body.expires_at || null,
      })
      .select('id, code, discount_pct, description, expires_at, used_at')
      .single();

    if (error) {
      if (/duplicate key/i.test(error.message || '')) throw ApiError.conflict('Ya existe un cupón con ese código');
      throw ApiError.internal('No fue posible crear el cupón');
    }

    res.status(201).json({ coupon: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
