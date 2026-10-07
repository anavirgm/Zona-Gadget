'use strict';

/**
 * Error de aplicación con forma de respuesta HTTP controlada.
 *
 * Los controladores lanzan ApiError y el middleware central `errorHandler`
 * traduce a un payload consistente:
 *   { code, message, details? }
 */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }

  static badRequest(message = 'Solicitud inválida', details) {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Se requiere autenticación') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'No tienes permisos para esta acción') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message = 'Conflicto con el estado actual del recurso') {
    return new ApiError(409, 'conflict', message);
  }

  static internal(message = 'Error interno del servidor') {
    return new ApiError(500, 'internal_error', message);
  }

  toJSON() {
    const body = { code: this.code, message: this.message };
    if (this.details) body.details = this.details;
    return body;
  }
}

module.exports = { ApiError };
