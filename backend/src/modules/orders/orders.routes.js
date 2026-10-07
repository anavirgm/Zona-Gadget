'use strict';

/**
 * Rutas de órdenes:
 *   GET  /api/orders        → mis pedidos
 *   GET  /api/orders/:id    → detalle de un pedido
 *   POST /api/orders        → crear pedido desde el carrito
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const ordersService = require('./orders.service');

const router = express.Router();

router.use(authenticate);

const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).max(20).required(),
      })
    )
    .min(1)
    .max(30)
    .required(),
  redemptionIds: Joi.array().items(Joi.string().uuid()).max(5).optional(),
}).unknown(true);

router.get('/', async (req, res, next) => {
  try {
    res.json({ orders: await ordersService.listByUser(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await ordersService.getById(req.params.id);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createOrderSchema), async (req, res, next) => {
  try {
    const order = await ordersService.create({
      userId: req.user.id,
      items: req.body.items,
      redemptionIds: req.body.redemptionIds,
    });
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
