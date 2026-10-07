'use strict';

/**
 * Rutas de autenticación: POST /api/auth/register · /login · /logout
 * GET /api/auth/session → perfil del usuario autenticado.
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimit');
const authService = require('./auth.service');

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(72).required(),
  displayName: Joi.string().min(2).max(80).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).max(72).required(),
});

router.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: 'auth:register' }),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await authService.register(req.body, res));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, scope: 'auth:login' }),
  validate(loginSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.login(req.body, res));
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', async (req, res, next) => {
  try {
    res.json(await authService.logout(res));
  } catch (err) {
    next(err);
  }
});

router.get('/session', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
