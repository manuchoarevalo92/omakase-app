-- Separar preparaciones por área (delivery / barra). Ejecutá si ya creaste preparaciones sin columna area.

alter table public.preparaciones
  add column if not exists area text not null default 'delivery';

alter table public.preparaciones
  drop constraint if exists preparaciones_area_check;

alter table public.preparaciones
  add constraint preparaciones_area_check
  check (area in ('delivery', 'barra'));

drop index if exists public.preparaciones_nombre_unq;

create unique index if not exists preparaciones_nombre_area_unq
  on public.preparaciones (lower(nombre), area);

comment on column public.preparaciones.area is
  'Área de producción: delivery (cocina/servicio) o barra.';
