'use strict';

/**
 * Rutas de cupones:
 *   POST /api/coupons/apply        → aplica un cupón de un solo uso
 *   GET  /api/coupons/redemptions  → mis redenciones
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const couponsService = require('./coupons.service');

const router = express.Router();

router.use(authenticate);

const applyCouponSchema = Joi.object({
  code: Joi.string().min(3).max(40).required(),
}).unknown(true);

router.post('/apply', validate(applyCouponSchema), async (req, res, next) => {
  try {
    const result = await couponsService.applyCoupon(req.user.id, req.body.code);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/redemptions', async (req, res, next) => {
  try {
    res.json({ redemptions: await couponsService.listMyRedemptions(req.user.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
