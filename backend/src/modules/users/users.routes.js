'use strict';

/**
 * Rutas de usuarios:
 *   GET   /api/users/me          → perfil completo (sesión)
 *   PUT   /api/users/profile     → actualización parcial del perfil
 *   GET   /api/users/profile/:id → perfil público de otro usuario
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const usersService = require('./users.service');

const router = express.Router();

/**
 * Schema de actualización de perfil.
 * Solo se validan los tipos/formatos de los campos conocidos; las claves
 * adicionales se toleran por compatibilidad (ver users.service#updateProfile).
 */
const updateProfileSchema = Joi.object({
  display_name: Joi.string().min(2).max(80).optional(),
  bio: Joi.string().max(280).allow('').optional(),
  avatar_url: Joi.string().uri({ allowRelative: true }).max(500).allow('').optional(),
}).unknown(true);

router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({ user: await usersService.getProfile(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await usersService.updateProfile(req.user.id, req.body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get('/profile/:id', authenticate, async (req, res, next) => {
  try {
    res.json({ user: await usersService.getPublicProfile(req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
