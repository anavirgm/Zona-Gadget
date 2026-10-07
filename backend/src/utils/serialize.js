'use strict';

/**
 * Serialización de perfiles: una única fuente de verdad para el contrato de
 * respuesta del API (snake_case en DB → camelCase en JSON).
 */

function serializeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email ?? null,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    role: row.role ?? 'customer',
    isVerified: Boolean(row.is_verified),
    createdAt: row.created_at ?? null,
  };
}

module.exports = { serializeProfile };
