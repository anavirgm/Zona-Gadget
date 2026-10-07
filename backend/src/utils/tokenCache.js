'use strict';

const crypto = require('crypto');

/**
 * Caché de sesiones verificadas a nivel de proceso.
 *
 * Objetivo de rendimiento: verificar la firma HMAC de Supabase + consultar el
 * perfil en Postgres era el hot path más costoso de la API (~2 round-trips por
 * request). Una vez verificado el token en la primera petición, las siguientes
 * se sirven desde memoria.
 *
 * Los access tokens de Supabase son de corta duración (1h por defecto) y el
 * logout es una operación poco frecuente, por lo que una entrada por proceso
 * se consideró suficiente para el volumen actual de la plataforma.
 */
class SessionCache {
  constructor() {
    /** @type {Map<string, { user: object, cachedAt: number }>} */
    this.entries = new Map();
  }

  /** Hash del token: nunca guardamos el JWT crudo en memoria (heap dumps). */
  #key(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  get(token) {
    const entry = this.entries.get(this.#key(token));
    return entry ? entry.user : null;
  }

  set(token, user) {
    this.entries.set(this.#key(token), { user, cachedAt: Date.now() });
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}

module.exports = { sessionCache: new SessionCache() };
