-- Tabla para registrar bebidas por asiento (1..8) en tiempo real.

create table if not exists public.bebidas_asientos (
  asiento integer primary key,
  consumos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint bebidas_asientos_numero_check check (asiento between 1 and 8)
);

comment on table public.bebidas_asientos is
  'Bebidas por asiento cargadas desde la app.';
