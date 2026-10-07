'use strict';

/**
 * Rutas de catálogo (públicas):
 *   GET /api/products        → listado con filtros
 *   GET /api/products/:id    → detalle
 */

const express = require('express');
const productsService = require('./products.service');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await productsService.list({
      category: req.query.category,
      q: req.query.q,
      featured: req.query.featured,
    });
    res.json({ products: items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await productsService.getById(req.params.id);
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
