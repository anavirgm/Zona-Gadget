'use strict';

/**
 * Middleware central de errores.
 *
 * Cualquier ApiError lanzado en una capa inferior se traduce a su payload;
 * el resto de errores se normalizan a 500 sin filtrar detalles internos.
 */

const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error('API error', { code: err.code, message: err.message });
    }
    return res.status(err.status).json(err.toJSON());
  }

  // Errores de body malformado de express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'invalid_json', message: 'JSON inválido en el cuerpo de la petición' });
  }

  logger.error('Error no controlado', { message: err.message, stack: err.stack });
  return res.status(500).json({ code: 'internal_error', message: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
