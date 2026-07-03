-- Preparaciones de cocina (Tosazu, Nikiri, etc.) con duración aproximada y recordatorios.
-- Alimenta la pantalla /produccion.
-- Idempotente: sirve si la tabla no existe o si ya existía una versión anterior.

create table if not exists public.preparaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  duracion_dias integer not null default 7,
  buffer_pct integer not null default 15,
  seguimiento_activo boolean not null default true,
  pendiente boolean not null default false,
  fecha_ultima_produccion date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columnas añadidas después (migraciones area + cantidad)
alter table public.preparaciones
  add column if not exists area text not null default 'delivery';

alter table public.preparaciones
  add column if not exists cantidad_referencia numeric(12, 3) not null default 1;

alter table public.preparaciones
  add column if not exists unidad_cantidad text not null default 'ud';

alter table public.preparaciones
  add column if not exists ultima_cantidad numeric(12, 3);

alter table public.preparaciones
  drop constraint if exists preparaciones_duracion_dias_check;

alter table public.preparaciones
  add constraint preparaciones_duracion_dias_check
  check (duracion_dias >= 1 and duracion_dias <= 365);

alter table public.preparaciones
  drop constraint if exists preparaciones_buffer_pct_check;

alter table public.preparaciones
  add constraint preparaciones_buffer_pct_check
  check (buffer_pct between 0 and 90);

alter table public.preparaciones
  drop constraint if exists preparaciones_area_check;

alter table public.preparaciones
  add constraint preparaciones_area_check
  check (area in ('delivery', 'barra'));

alter table public.preparaciones
  drop constraint if exists preparaciones_cantidad_referencia_check;

alter table public.preparaciones
  add constraint preparaciones_cantidad_referencia_check
  check (cantidad_referencia > 0);

alter table public.preparaciones
  drop constraint if exists preparaciones_ultima_cantidad_check;

alter table public.preparaciones
  add constraint preparaciones_ultima_cantidad_check
  check (ultima_cantidad is null or ultima_cantidad > 0);

alter table public.preparaciones
  drop constraint if exists preparaciones_unidad_cantidad_check;

alter table public.preparaciones
  add constraint preparaciones_unidad_cantidad_check
  check (unidad_cantidad in ('L', 'ml', 'kg', 'g', 'ud'));

drop index if exists public.preparaciones_nombre_unq;

create unique index if not exists preparaciones_nombre_area_unq
  on public.preparaciones (lower(nombre), area);

comment on table public.preparaciones is
  'Preparaciones de cocina hechas en casa (salsas, caldos, etc.) con duración y recordatorio de rehacer.';
comment on column public.preparaciones.duracion_dias is
  'Cuántos días dura aproximadamente un lote antes de tener que rehacerlo.';
comment on column public.preparaciones.buffer_pct is
  'Margen (10-20%, default 15): avisa ese % antes de que se cumpla la duración.';
comment on column public.preparaciones.pendiente is
  'Marcado manualmente: hay que hacer esta preparación pronto.';
comment on column public.preparaciones.fecha_ultima_produccion is
  'Última vez que se marcó como hecha; base para el recordatorio automático.';
comment on column public.preparaciones.area is
  'Área de producción: delivery (cocina/servicio) o barra.';
comment on column public.preparaciones.cantidad_referencia is
  'Tamaño del lote para el que duracion_dias está calibrado (ej. 1 L → 7 días).';
comment on column public.preparaciones.unidad_cantidad is
  'Unidad de cantidad_referencia y ultima_cantidad: L, ml, kg, g, ud.';
comment on column public.preparaciones.ultima_cantidad is
  'Cantidad del último lote hecho; escala el recordatorio proporcionalmente.';
