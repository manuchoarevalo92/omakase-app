-- Categoría de actividad en el plan semanal, definida por preparación.
-- Ejecutar en Supabase si la tabla preparaciones ya existe.

alter table public.preparaciones
  add column if not exists categoria_plan text not null default 'produ';

alter table public.preparaciones
  drop constraint if exists preparaciones_categoria_plan_check;

update public.preparaciones
set categoria_plan = 'produ'
where categoria_plan in ('prep_barra', 'produ');

update public.preparaciones
set categoria_plan = 'servicio'
where categoria_plan in ('servicio_barra', 'servicio_delivery', 'servicio');

alter table public.preparaciones
  add constraint preparaciones_categoria_plan_check
  check (categoria_plan in ('produ', 'servicio'));

comment on column public.preparaciones.categoria_plan is
  'Tipo en plan semanal: produ (manual) o servicio (auto al pasar hora_fin).';
