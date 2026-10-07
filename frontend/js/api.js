/**
 * Cliente HTTP del SPA.
 *
 * - Guarda el access token en localStorage para las peticiones XHR.
 * - La cookie `zg_session` (HttpOnly, fijada por el backend) paralela este
 *   token para las vistas server-renderizadas como /account.
 */

const TOKEN_KEY = 'zg_token';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

/**
 * Fetch envolvente: JSON in/out, header Authorization y errores normalizados.
 */
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = auth.token;

  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      payload?.message || `Error ${res.status}`,
      res.status,
      payload?.code || 'unknown',
      payload?.details
    );
  }

  return payload;
}
