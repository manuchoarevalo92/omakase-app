-- Sesiones cronometradas de producción (preparaciones de cocina).
-- Alimenta /produccion-tiempos.

create table if not exists public.produccion_sesiones (
  id uuid primary key default gen_random_uuid(),
  preparacion_id uuid references public.preparaciones(id) on delete set null,
  preparacion_nombre text not null,
  area text not null default 'delivery',
  started_at timestamptz not null,
  ended_at timestamptz,
  pausado_at timestamptz,
  pausa_total_segundos integer not null default 0,
  duracion_segundos integer,
  cantidad_producida numeric(12, 3),
  unidad_cantidad text,
  hecho_por_id text,
  hecho_por_nombre text,
  notas text,
  es_manual boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.produccion_sesiones
  drop constraint if exists produccion_sesiones_area_check;

alter table public.produccion_sesiones
  add constraint produccion_sesiones_area_check
  check (area in ('delivery', 'barra'));

alter table public.produccion_sesiones
  drop constraint if exists produccion_sesiones_pausa_total_segundos_check;

alter table public.produccion_sesiones
  add constraint produccion_sesiones_pausa_total_segundos_check
  check (pausa_total_segundos >= 0);

alter table public.produccion_sesiones
  drop constraint if exists produccion_sesiones_duracion_segundos_check;

alter table public.produccion_sesiones
  add constraint produccion_sesiones_duracion_segundos_check
  check (duracion_segundos is null or duracion_segundos > 0);

alter table public.produccion_sesiones
  drop constraint if exists produccion_sesiones_cantidad_producida_check;

alter table public.produccion_sesiones
  add constraint produccion_sesiones_cantidad_producida_check
  check (cantidad_producida is null or cantidad_producida > 0);

alter table public.produccion_sesiones
  drop constraint if exists produccion_sesiones_unidad_cantidad_check;

alter table public.produccion_sesiones
  add constraint produccion_sesiones_unidad_cantidad_check
  check (unidad_cantidad is null or unidad_cantidad in ('L', 'ml', 'kg', 'g', 'ud'));

create index if not exists produccion_sesiones_started_at_idx
  on public.produccion_sesiones (started_at desc);

create index if not exists produccion_sesiones_preparacion_idx
  on public.produccion_sesiones (preparacion_id, started_at desc);

create index if not exists produccion_sesiones_hecho_por_idx
  on public.produccion_sesiones (hecho_por_id, started_at desc);

create index if not exists produccion_sesiones_activas_idx
  on public.produccion_sesiones (hecho_por_id)
  where ended_at is null;

comment on table public.produccion_sesiones is
  'Cronómetro de producción: duración real por preparación para planificar la semana.';
comment on column public.produccion_sesiones.preparacion_nombre is
  'Copia del nombre al guardar (por si se borra la preparación).';
comment on column public.produccion_sesiones.ended_at is
  'Null mientras el cronómetro está en curso.';
comment on column public.produccion_sesiones.es_manual is
  'True si se cargó duración a mano sin cronómetro en vivo.';
