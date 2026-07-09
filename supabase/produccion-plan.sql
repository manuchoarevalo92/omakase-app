-- Plan semanal de producción: bloques horarios y tareas asignadas.
-- Alimenta /produccion-plan.

create table if not exists public.produccion_bloques (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null,
  hora_inicio text not null,
  hora_fin text not null,
  area text not null default 'delivery',
  titulo text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.produccion_bloques
  drop constraint if exists produccion_bloques_dia_semana_check;

alter table public.produccion_bloques
  add constraint produccion_bloques_dia_semana_check
  check (dia_semana between 1 and 7);

alter table public.produccion_bloques
  drop constraint if exists produccion_bloques_area_check;

alter table public.produccion_bloques
  add constraint produccion_bloques_area_check
  check (area in ('delivery', 'barra'));

create index if not exists produccion_bloques_dia_orden_idx
  on public.produccion_bloques (dia_semana, orden, hora_inicio);

comment on table public.produccion_bloques is
  'Plantilla semanal de bloques horarios de producción (1=lunes … 7=domingo).';
comment on column public.produccion_bloques.dia_semana is
  'Día ISO: 1=lunes, 7=domingo.';

create table if not exists public.produccion_plan (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora_inicio text not null default '09:00',
  hora_fin text not null default '10:00',
  bloque_id uuid references public.produccion_bloques(id) on delete set null,
  preparacion_id uuid references public.preparaciones(id) on delete set null,
  preparacion_nombre text not null,
  area text not null default 'delivery',
  duracion_estimada_segundos integer not null,
  cantidad_planificada numeric(12, 3),
  unidad_cantidad text,
  asignado_a_id text,
  asignado_a_nombre text,
  notas text,
  categoria text not null default 'produ',
  estado text not null default 'pendiente',
  orden integer not null default 0,
  creado_por_id text,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);

alter table public.produccion_plan
  drop constraint if exists produccion_plan_area_check;

alter table public.produccion_plan
  add constraint produccion_plan_area_check
  check (area in ('delivery', 'barra'));

alter table public.produccion_plan
  drop constraint if exists produccion_plan_categoria_check;

alter table public.produccion_plan
  add constraint produccion_plan_categoria_check
  check (categoria in ('produ', 'servicio'));

alter table public.produccion_plan
  drop constraint if exists produccion_plan_estado_check;

alter table public.produccion_plan
  add constraint produccion_plan_estado_check
  check (estado in ('pendiente', 'completada', 'cancelada'));

alter table public.produccion_plan
  drop constraint if exists produccion_plan_duracion_estimada_segundos_check;

alter table public.produccion_plan
  add constraint produccion_plan_duracion_estimada_segundos_check
  check (duracion_estimada_segundos > 0);

alter table public.produccion_plan
  drop constraint if exists produccion_plan_cantidad_planificada_check;

alter table public.produccion_plan
  add constraint produccion_plan_cantidad_planificada_check
  check (cantidad_planificada is null or cantidad_planificada > 0);

alter table public.produccion_plan
  drop constraint if exists produccion_plan_unidad_cantidad_check;

alter table public.produccion_plan
  add constraint produccion_plan_unidad_cantidad_check
  check (unidad_cantidad is null or unidad_cantidad in ('L', 'ml', 'kg', 'g', 'ud'));

create index if not exists produccion_plan_fecha_hora_idx
  on public.produccion_plan (fecha, hora_inicio);

create index if not exists produccion_plan_fecha_idx
  on public.produccion_plan (fecha, orden);

comment on table public.produccion_plan is
  'Preparaciones planificadas en la grilla semanal con hora de inicio y fin.';
comment on column public.produccion_plan.categoria is
  'produ: se marca hecha manualmente. servicio: se completa sola al pasar hora_fin.';
comment on column public.produccion_plan.hora_inicio is
  'Inicio del bloque en la grilla (HH:MM).';
comment on column public.produccion_plan.hora_fin is
  'Fin del bloque en la grilla (HH:MM).';
comment on column public.produccion_plan.duracion_estimada_segundos is
  'Duración estimada (p. ej. mediana de produccion_sesiones).';
