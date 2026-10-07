-- ================================================================
--  Zona Gadget · Esquema Supabase (Postgres)
--  Ejecutar en el SQL Editor del proyecto, de arriba hacia abajo.
--  Idempotente: puede re-ejecutarse sin dañar datos existentes.
-- ================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------
--  PROFILES
-- ----------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null default '',
  bio          text,
  avatar_url   text,
  -- Rol de autorización usado por la API (requireRole).
  role         text not null default 'customer' check (role in ('customer', 'admin')),
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Alta automática del perfil al registrarse un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
--  PRODUCTS (catálogo)
-- ----------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text not null default '',
  category         text not null,
  price_cents      integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents >= price_cents),
  stock            integer not null default 0 check (stock >= 0),
  icon             text not null default '📦',
  -- Ruta local de la foto (servida por Express desde frontend/assets/products/).
  -- No se usan buckets de Supabase Storage: los assets viven en el repo.
  image_url        text,
  accent           text not null default 'violet',
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------
--  ORDERS / ORDER_ITEMS
-- ----------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'pending'
                 check (status in ('pending', 'paid', 'shipped', 'cancelled', 'failed')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents    integer not null check (total_cents >= 0),
  coupon_ids     uuid[] not null default '{}',
  created_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  -- Snapshot del catálogo al momento de la compra (el precio no debe mutar).
  product_name     text not null,
  icon             text not null default '📦',
  image_url        text,               -- snapshot de la foto al momento de comprar
  quantity         integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

-- ----------------------------------------------------------------
--  COUPONS / COUPON_REDEMPTIONS
-- ----------------------------------------------------------------
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  discount_pct integer not null check (discount_pct between 1 and 100),
  description text not null default '',
  expires_at  timestamptz,
  -- Un solo uso por cupón: null → disponible; timestamp → canjeado.
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Registro append-only de canjes (auditoría + descuentos aplicados al checkout).
create table if not exists public.coupon_redemptions (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid not null references public.coupons (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  discount_pct integer not null,
  order_id     uuid references public.orders (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
--  ÍNDICES
-- ----------------------------------------------------------------
create index if not exists idx_orders_user_created   on public.orders (user_id, created_at desc);
create index if not exists idx_order_items_order     on public.order_items (order_id);
create index if not exists idx_products_category     on public.products (category) where is_active;
create index if not exists idx_redemptions_user      on public.coupon_redemptions (user_id, created_at desc);

-- ================================================================
--  ROW LEVEL SECURITY
--  Protege los accesos directos a la DB (PostgREST / dashboard).
--  La API usa la service role key, que bypasea RLS por diseño: allí la
--  condición de propiedad se aplica en la capa de servicio.
-- ================================================================

alter table public.profiles          enable row level security;
alter table public.products          enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.coupons           enable row level security;
alter table public.coupon_redemptions enable row level security;

-- PROFILES --------------------------------------------------------
-- Los perfiles son visibles públicamente (prueba social en reseñas).
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Cada usuario edita su propia fila (el rol lo administra la API).
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- PRODUCTS --------------------------------------------------------
create policy "products_read_active"
  on public.products for select
  to anon, authenticated
  using (is_active);
-- Escrituras solo desde la API (service role): sin policy de insert/update.

-- ORDERS ----------------------------------------------------------
-- Un usuario solo observa sus propias órdenes en acceso directo.
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ORDER_ITEMS -----------------------------------------------------
create policy "order_items_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

create policy "order_items_insert_own"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

-- COUPONS ---------------------------------------------------------
-- Sin policies: los cupones se gestionan exclusivamente vía la API.
-- Los usuarios ni siquiera pueden leerlos en PostgREST directo.

-- COUPON_REDEMPTIONS ----------------------------------------------
create policy "redemptions_select_own"
  on public.coupon_redemptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
-- Escrituras solo desde la API (service role).

-- ================================================================
--  DATOS SEMILLA
-- ================================================================

-- Catálogo inicial (gadgets de tecnología). Las fotos viven en
-- frontend/assets/products/<slug>.jpg y Express las sirve como estáticos.
insert into public.products (slug, name, description, category, price_cents, compare_at_cents, stock, icon, image_url, accent, is_featured) values
  ('zephyr-14',        'Laptop Zephyr 14"',        'Ultrabook 14" con Ryzen 7, 16 GB RAM y SSD 1 TB. Perfecta para trabajo y desarrollo.', 'Laptops',    129900, 149900, 25, '💻', '/assets/products/zephyr-14.jpg',        'indigo',  true),
  ('novabuds-pro',     'Auriculares NovaBuds Pro', 'ANC híbrido, 32 h de batería total y certificación Hi-Res Audio.',                  'Audio',       19900,  24900, 120, '🎧', '/assets/products/novabuds-pro.jpg',     'violet', true),
  ('boomsphere-360',   'Altavoz BoomSphere 360',   'Sonido 360°, IPX7 y 24 h de reproducción. Empareja hasta 2 dispositivos.',          'Audio',       14900,  17900, 80,  '🔊', '/assets/products/boomsphere-360.jpg',   'fuchsia', false),
  ('pulse-x',          'Smartwatch Pulse X',       'GPS doble, SpO₂ y 10 días de batería. Compatible con iOS y Android.',               'Wearables',   34900,  39900, 60,  '⌚', '/assets/products/pulse-x.jpg',          'cyan',   true),
  ('skycam-mini',      'Drone SkyCam Mini',        'Cámara 4K con gimbal de 3 ejes, 34 min de vuelo y modo Follow-Me.',                  'Drones',      59900,  69900, 15,  '🛸', '/assets/products/skycam-mini.jpg',      'sky',    true),
  ('voltbox-series-x', 'Consola VoltBox Series X', '4K/120 Hz, 1 TB NVMe y mando háptico incluido.',                                     'Gaming',      49900,  54900, 30,  '🎮', '/assets/products/voltbox-series-x.jpg', 'rose',   false),
  ('k87-rgb',          'Teclado Mecánico K87 RGB', 'Switches hot-swap, doble inalámbrico y keycaps PBT.',                                'Periféricos', 12900,  15900, 150, '⌨️', '/assets/products/k87-rgb.jpg',          'amber',  false),
  ('ultraview-27-4k',  'Monitor UltraView 27" 4K', 'IPS 144 Hz, 98% DCI-P3 y USB-C 90 W con Power Delivery.',                           'Monitores',   54900,  64900, 40,  '🖥️', '/assets/products/ultraview-27-4k.jpg',  'emerald', true),
  ('sketchpad-11',     'Tablet SketchPad 11',      'Pantalla 11" 120 Hz, lápiz con 4096 niveles de presión y 256 GB.',                   'Tablets',     49900,  55900, 35,  '📲', '/assets/products/sketchpad-11.jpg',     'teal',   false),
  ('retroshot-200',    'Cámara RetroShot 200',     'Retro compacta de 28 MP con flash integrado y conectividad Wi-Fi.',                 'Fotografía',  89900,  99900, 20,  '📷', '/assets/products/retroshot-200.jpg',    'orange', false)
on conflict (slug) do nothing;

-- Cupones de campaña.
insert into public.coupons (code, discount_pct, description, expires_at) values
  ('WELCOME10', 10, 'Bienvenida — 10% en tu primer pedido', null),
  ('FLASH25',   25, 'Flash sale TechWeek — uso único',      null),
  ('SUMMER15',  15, 'Campaña de verano (expirado)',         '2026-01-31T23:59:59Z')
on conflict (code) do nothing;

-- ---------------------------------------------------------------
--  Bootstrap del primer administrador (ejecutar manualmente):
--
--  update public.profiles
--    set role = 'admin'
--    where email = 'admin@zonagadget.dev';
-- ---------------------------------------------------------------

-- ================================================================
--  MIGRACIÓN · fotos de producto (instalaciones existentes)
--  Si ya ejecutaste este archivo antes de existir `image_url`,
--  pega solo este bloque en el SQL Editor:
--
--  alter table public.products   add column if not exists image_url text;
--  alter table public.order_items add column if not exists image_url text;
--  update public.products
--     set image_url = '/assets/products/' || slug || '.jpg'
--   where image_url is null;
-- ================================================================
