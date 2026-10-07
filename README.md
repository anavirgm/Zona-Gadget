# Zona Gadget · Laboratorio de Auditoría de Seguridad

E-commerce moderno de equipos y gadgets de tecnología construido como **laboratorio realista de auditoría de seguridad**. El código aparenta seguir buenas prácticas (arquitectura modular, validación con Joi, RLS en Supabase, JWT verificado, caches de rendimiento), pero contiene **cinco fallas avanzadas deliberadas** alineadas con OWASP.

> ⚠️ **Uso exclusivo con fines educativos y de auditoría autorizada.** Este repositorio no debe desplegarse en producción ni exponerse a Internet.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | SPA (HTML5 + Tailwind CSS + JavaScript ES Modules, History API router) |
| Backend | Node.js 18+ · Express 4 (API RESTful modular) |
| Datos / Auth | Supabase (Postgres + Supabase Auth + RLS) |
| Sesión | Access token JWT de Supabase (header `Authorization` + cookie `zg_session`) |
| Calidad | ESLint, validación de payloads con Joi, rate limiting en memoria |

---

## Estructura del proyecto

```
Zona-Gadget/
├── frontend/                     # SPA (estáticos servidos por Express)
│   ├── index.html                # Shell + slot de hidratación SSR
│   ├── css/styles.css            # Sistema de diseño (cards, botones, inputs)
│   ├── assets/products/          # Fotos reales del catálogo (una por slug)
│   └── js/
│       ├── app.js                # Bootstrap: sesión → navbar → router
│       ├── router.js             # History API router (SPA)
│       ├── api.js                # Cliente fetch + token
│       ├── store.js              # Estado: usuario, carrito, cupones
│       ├── components.js         # UI compartida (escapeHtml, toasts, cards)
│       └── views/                # home · shop · product · cart · auth · account · admin
│
├── backend/
│   ├── package.json
│   ├── .env.example              # Plantilla de configuración (.env no se versiona)
│   └── src/
│       ├── server.js             # Arranque + graceful shutdown
│       ├── app.js                # Composición de middlewares y routers
│       ├── config/               # env · clientes Supabase (anon + service)
│       ├── middleware/           # auth (JWT+caché) · validate · rateLimit · errorHandler
│       ├── modules/              # Rutas + servicios por dominio
│       │   ├── auth/             # register · login · logout · session
│       │   ├── users/            # perfil (GET/PUT) · perfil público
│       │   ├── products/         # catálogo público
│       │   ├── orders/           # mis pedidos · detalle · checkout
│       │   ├── coupons/          # apply · redemptions
│       │   └── admin/            # backoffice (rol admin)
│       ├── ssr/index.js          # Render de /account con estado embebido
│       └── utils/                # errors · logger · tokenCache · serialize
│
├── supabase/
│   └── schema.sql                # Esquema completo + RLS + seeds
└── README.md
```

---

## Puesta en marcha

### 1. Proyecto Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → ejecuta todo `supabase/schema.sql` (tablas, trigger de perfiles, RLS y seeds).
   - *Instalación previa:* si la base ya existía antes de la columna `image_url`, ejecuta también el bloque de migración comentado al final del archivo.
3. **Authentication → Providers** → habilita *Email* y desactiva **Confirm email** (para pruebas rápidas).
4. Copia desde **Project Settings → API**: `Project URL`, `anon key`, `service_role key` y `JWT Secret`.

> 🖼️ **Imágenes de producto:** viven en `frontend/assets/products/<slug>.jpg`
> (fotos de stock con licencia libre de Unsplash). No se usa Supabase Storage:
> Express sirve la carpeta como estático en `/assets/products/…`.

### 2. Configuración local

```bash
cd backend
cp .env.example .env      # completa URL, keys y JWT secret de tu proyecto
npm install
npm run dev               # http://localhost:4000
```

Express sirve la API (`/api/*`) **y** la SPA en el mismo origen → no hace falta servidor de estáticos aparte.

### 3. Datos de prueba

**Seed incluido en el SQL** (42 productos del catálogo + cupones):

| Código | Descuento | Notas |
|---|---|---|
| `WELCOME10` | 10 % | Ilimitado (hasta agotar vigencia) |
| `FLASH25` | 25 % | **Uso único** → objetivo del escenario de race condition |
| `SUMMER15` | 15 % | Expirado (2026-01-31) para probar validaciones |

**Primer administrador** (bootstrap manual desde el SQL Editor de Supabase):

```sql
update public.profiles set role = 'admin' where email = 'admin@zonagadget.dev';
```

---

## Despliegue en Vercel

El repo trae la configuración lista: `vercel.json`, `api/index.js` y un `package.json` en la raíz.

- **`api/index.js`** exporta la app de Express tal cual: el runtime de Vercel invoca la exportación como listener HTTP `(req, res)`, que es exactamente la firma de una app de Express — no se necesita `serverless-http` ni ningún adapter, y no se llama `app.listen()`.
- **`vercel.json`** reescribe todas las rutas (`/(.*)` → `/api/index`) y empaqueta `frontend/` en la Function con `includeFiles`, para que Express siga sirviendo la SPA, sus assets y las fotos de producto (los archivos estáticos que existan en la raíz se resuelven antes del rewrite).
- **`package.json` (raíz)** duplica las dependencias de `backend/package.json`: Vercel instala las dependencias desde la raíz del repo. Si agregas una dependencia al backend, agrégala también en la raíz.

### Pasos

1. **Variables de entorno** en el dashboard (*Project Settings → Environment Variables*). El `.env` no se despliega (está en `.gitignore`):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://<proyecto>.vercel.app` |
   | `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_JWT_SECRET` | Project Settings → API de Supabase |
   | `LOG_LEVEL` | `info` |

2. **Desplegar** (cualquiera de las dos):
   - **Git:** importa el repo en [vercel.com](https://vercel.com) — detecta `vercel.json` sin pasos extra.
   - **CLI:** `npx vercel` (preview) y luego `npx vercel --prod`.

3. **Verificar:** `GET https://<proyecto>.vercel.app/api/health` → `{"status":"ok"}`.

### Consideraciones en serverless

- ⚠️ La caché de sesiones y el rate limiting van **en memoria**: en Vercel se reinician en cada cold start y no se comparten entre instancias. La V4 (bypass de revocación JWT) se comporta distinto que en local: el token cacheado deja de servir tras un cold start.
- Mantén activa la **Password Protection / Deployment Protection** de Vercel: el laboratorio no debe exponerse en Internet (ver advertencia al inicio).
- El desarrollo local no cambia: `cd backend && npm run dev`.

---

## Referencia de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | – | Registro (Supabase Auth + trigger de perfil) |
| POST | `/api/auth/login` | – | Login → token JWT + cookie `zg_session` |
| POST | `/api/auth/logout` | – | Limpia cookie y token del cliente |
| GET | `/api/auth/session` | ✔ | Perfil de la sesión actual |
| GET | `/api/users/me` | ✔ | Perfil completo |
| PUT | `/api/users/profile` | ✔ | Actualización parcial del perfil |
| GET | `/api/users/profile/:id` | ✔ | Perfil público de otro usuario |
| GET | `/api/products` | – | Catálogo (`?category= &q= &featured=1`) |
| GET | `/api/products/:id` | – | Detalle de producto |
| GET | `/api/orders` | ✔ | Mis pedidos |
| GET | `/api/orders/:id` | ✔ | Detalle de pedido |
| POST | `/api/orders` | ✔ | Checkout (precursos del catálogo) |
| POST | `/api/coupons/apply` | ✔ | Aplicar cupón de un solo uso |
| GET | `/api/coupons/redemptions` | ✔ | Mis redenciones |
| GET | `/api/admin/users` | admin | Listado de usuarios |
| GET | `/api/admin/orders` | admin | Todos los pedidos |
| POST | `/api/admin/coupons` | admin | Alta de cupones |
| GET | `/account` | cookie | Vista SSR con estado embebido |

---

## Mapa de vulnerabilidades (laboratorio)

Cinco fallas **deliberadas y realistas**. Cada una incluye dónde está el código, por qué parece correcta y cómo reproducirla de forma controlada.

### V1 · Mass Assignment en actualización de perfil
**OWASP:** A01 Broken Access Control · *IDOR sutil*
**Dónde:**
- `backend/src/modules/users/users.service.js` → `updateProfile()` hace `{ ...payload }` directo sobre `profiles`.
- `backend/src/modules/users/users.routes.js` → `updateProfileSchema` valida tipos de campos conocidos pero `.unknown(true)` no filtra claves extra.
**Por qué parece correcta:** el comentario documenta la lista de campos y argumenta que Postgres valida el resto.
**Reproducción:**
```http
PUT /api/users/profile
Authorization: Bearer <token_de_usuario_normal>

{ "bio": "Auditor", "role": "admin", "is_verified": true }
```
→ el perfil responde `"role": "admin"`. Con `GET /api/admin/users` se confirma la escalada (tras el flush de caché que dispara el propio update). **Impacto:** compromiso total del backoffice.

### V2 · IDOR en detalle de pedido (RLS bypaseado)
**OWASP:** A01 Broken Access Control
**Dónde:** `backend/src/modules/orders/orders.service.js` → `getById()` consulta con el client *service role* por `id` sin comparar `user_id` con `req.user.id`.
**Por qué parece correcta:** la tabla `orders` tiene la política RLS `orders_select_own` y el comentario asume que la propiedad ya está garantizada (el id es un UUID no enumerable).
**Reproducción:**
1. Usuario A crea un pedido → copia su `order.id`.
2. Usuario B: `GET /api/orders/<order_id_de_A>` → **200 con la orden completa** (items, totales, cupones). Debería ser 403/404.
*Nota:* el listado `GET /api/orders` sí filtra por dueño — la falla es solo en el lookup por id.

### V3 · XSS vía hidratación de estado (JSON inyectado en `<script>`)
**OWASP:** A03 Injection · DOM XSS
**Dónde:** `backend/src/ssr/index.js` → `renderWithState()` construye
```js
window.__INITIAL_STATE__ = JSON.parse('<JSON.stringify(state)>');
```
sin escapar `<`, `>` ni `'` dentro del bloque `script`.
**Por qué parece correcta:** `JSON.stringify` produce JSON válido y el estado “ya pasó por validación”.
**Reproducción:**
```http
PUT /api/users/profile
{ "display_name": "</script><script>alert(document.domain)</script>" }
```
luego visita `GET /account` (con sesión) → el payload se ejecuta al cargar la vista. Una comilla simple en `bio` (ej. `it's fine`) también rompe el literal JS.
**Impacto:** ejecución de JS en el origen; robo de sesión con `document.cookie`/`localStorage`, defacement del panel.

### V4 · Bypass de expiración/revocación de JWT (caché de sesiones)
**OWASP:** A07 Identification & Authentication Failures
**Dónde:**
- `backend/src/utils/tokenCache.js` → entradas **sin TTL** por proceso.
- `backend/src/middleware/auth.js` → `resolveUserFromRequest()` consulta la caché **antes** de verificar firma/`exp` y no valida `aud`: una vez cacheado, el token se acepta mientras viva el proceso (la firma se resuelve bien por JWKS, pero solo se comprueba en el primer acceso).
**Por qué parece correcta:** “verificamos una sola vez; los tokens duran 1 h; el logout lo maneja el cliente”.
**Reproducción:**
1. Login → token A (válido 1 h). Usa la API: se cachea.
2. Cierra sesión (`POST /api/auth/logout`) o espera a que expire el token / revócalo desde el dashboard de Supabase.
3. Reenvía cualquier request con el token A → **sigue autenticado** mientras viva el proceso Node (verificado localmente: el token expirado resuelve desde caché).
**Impacto:** sesiones imposibles de revocar, ventanas de expiración ignoradas.

### V5 · Race condition en aplicar cupón
**OWASP:** A04 Insecure Design
**Dónde:** `backend/src/modules/coupons/coupons.service.js` → `applyCoupon()` hace **check → insert (auditoría) → mark** sin transacción atómica ni `UPDATE … WHERE used_at IS NULL`.
**Por qué parece correcta:** “Postgres serializa las escrituras” — pero el chequeo ocurre *antes* de la escritura.
**Reproducción:**
1. Envía `FLASH25` (uso único) **5 veces en paralelo** (Burp Repeater → *Go Single Unthrottled*, o `curl` multi-proceso):
```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:4000/api/coupons/apply \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"code":"FLASH25"}' &
done; wait
```
2. Varias respuestas devuelven **201 con `redemption.id` distinto** → múltiples redenciones activas del mismo cupón.
3. En el carrito, acumular cupones y verificar que el checkout **suma los descuentos** de todas las redenciones (`coupon_redemptions` sin constraint único).
**Impacto:** pérdida económica por descuentos múltiples.

### Archivos protegidos a propósito
- **No hay `.env` en el repo** (solo `.env.example` con placeholders) — `.gitignore` lo excluye.
- **No hay SQL por concatenación**: todas las consultas pasan por bindings del client de Supabase (`eq`, `in`, `ilike` parametrizado).

---

## Verificación rápida de la instalación

```bash
# Sintaxis backend
node --check src/server.js   # …y el resto de src/

# API de salud (con .env configurado)
curl http://localhost:4000/api/health
# {"status":"ok", …}

# Foto de producto servida desde frontend/assets/products/
curl -I http://localhost:4000/assets/products/zephyr-14.jpg
# HTTP/1.1 200 OK

# /account sin sesión → 302 a /login
curl -I http://localhost:4000/account
```

---

## Checklist de arquitectura (lo que sí está bien)

- ✅ Precios **siempre** resueltos en servidor (el checkout nunca confía en montos del cliente).
- ✅ Validación Joi en todos los endpoints con body.
- ✅ Rate limiting en endpoints de autenticación.
- ✅ Cookie de sesión `HttpOnly` + `SameSite=Lax`.
- ✅ RLS habilitado en todas las tablas (protege accesos directos vía PostgREST).
- ✅ Snapshot de nombre/precio en `order_items` (historial inmutable).
- ✅ Errores normalizados, logs estructurados JSON, helmet, CORS con credenciales.
- ✅ Escape de HTML (`escapeHtml`) en todo el renderizado cliente — el XSS inyectado vive en la capa SSR.

## Roadmap de endurecimiento (para después del laboratorio)

1. Allowlist explícita de campos en `PUT /api/users/profile`.
2. Ownership check (`user_id === req.user.id`) en `GET /api/orders/:id`.
3. Serializar el estado SSR con `\u003c`/`\u003e`/`\u0027` (o `window.__INITIAL_STATE__ = {…}` como JSON literal seguro).
4. TTL + revocación en la caché de sesiones; aud claim *required* (el proyecto firma con ES256 → JWKS).
5. `UPDATE coupons SET used_at = now() WHERE id = $1 AND used_at IS NULL` + constraint único en `coupon_redemptions`.
