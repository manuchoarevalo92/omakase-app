-- Bebidas por asiento (-2, -1, 1..8), asociadas a un cierre de menú en historial_servicios.
-- Los asientos -2 y -1 son dos extra habilitados; el resto van 1..8.

create table if not exists public.bebidas_asientos (
  historial_servicio_id uuid not null references public.historial_servicios(id) on delete cascade,
  asiento integer not null,
  consumos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (historial_servicio_id, asiento),
  constraint bebidas_asientos_numero_check check (asiento between -2 and 8)
);

create index if not exists bebidas_asientos_historial_idx
  on public.bebidas_asientos (historial_servicio_id);

comment on table public.bebidas_asientos is
  'Bebidas por asiento y por servicio (historial_servicios).';
