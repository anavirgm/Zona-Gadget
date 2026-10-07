'use strict';

const { ApiError } = require('../utils/errors');

/**
 * Middleware de validación de payloads basado en Joi.
 *
 * `schema` valida tipos/formats de los campos conocidos y rechaza requests
 * inválidas con 400. El body original de la request se conserva tal cual para
 * no perder claves adicionales que envíen clientes de versiones más nuevas
 * (los clientes móviles aún desplegados mandan campos extra en varios endpoints).
 */
function validate(schema) {
  return (req, _res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: false,
      allowUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(ApiError.badRequest('Payload inválido', details));
    }

    return next();
  };
}

module.exports = { validate };
