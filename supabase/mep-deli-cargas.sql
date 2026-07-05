-- Registros de MEP delivery cargados por servicio (cantidades por corte).
-- Alimenta /mep-deli.

create table if not exists public.mep_deli_cargas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  servicio text,
  historial_servicio_id uuid references public.historial_servicios(id) on delete set null,
  lineas jsonb not null default '[]'::jsonb,
  cargado_por_id text,
  cargado_por_nombre text,
  cierre_lineas jsonb,
  cierre_at timestamptz,
  cerrado_por_id text,
  cerrado_por_nombre text,
  created_at timestamptz not null default now()
);

alter table public.mep_deli_cargas
  add column if not exists cargado_por_id text;

alter table public.mep_deli_cargas
  add column if not exists cargado_por_nombre text;

alter table public.mep_deli_cargas
  add column if not exists cierre_lineas jsonb;

alter table public.mep_deli_cargas
  add column if not exists cierre_at timestamptz;

alter table public.mep_deli_cargas
  add column if not exists cerrado_por_id text;

alter table public.mep_deli_cargas
  add column if not exists cerrado_por_nombre text;

alter table public.mep_deli_cargas
  drop constraint if exists mep_deli_cargas_servicio_check;

alter table public.mep_deli_cargas
  add constraint mep_deli_cargas_servicio_check
  check (servicio is null or servicio in ('Noche'));

create index if not exists mep_deli_cargas_fecha_idx
  on public.mep_deli_cargas (fecha desc);

create unique index if not exists mep_deli_cargas_fecha_noche_unq
  on public.mep_deli_cargas (fecha)
  where servicio is null or servicio = 'Noche';

create index if not exists mep_deli_cargas_historial_idx
  on public.mep_deli_cargas (historial_servicio_id);

comment on table public.mep_deli_cargas is
  'MEP delivery guardada: fecha/servicio y cantidades por corte (JSON).';
comment on column public.mep_deli_cargas.lineas is
  'Array JSON: [{ "corte_id": "uuid", "cantidad": "120" }, ...].';
comment on column public.mep_deli_cargas.cargado_por_nombre is
  'Nombre visible de quien cargó la MEP.';
comment on column public.mep_deli_cargas.cierre_lineas is
  'Cierre: [{ "corte_id": "uuid", "resultado": "ok"|"falto"|"sobro", "cantidad": "2" }].';
