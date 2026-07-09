-- Categoría de actividad en el plan semanal, definida por preparación.
-- Ejecutar en Supabase si la tabla preparaciones ya existe.

alter table public.preparaciones
  add column if not exists categoria_plan text not null default 'prep_barra';

alter table public.preparaciones
  drop constraint if exists preparaciones_categoria_plan_check;

alter table public.preparaciones
  add constraint preparaciones_categoria_plan_check
  check (categoria_plan in ('prep_barra', 'servicio_barra', 'servicio_delivery'));

comment on column public.preparaciones.categoria_plan is
  'Tipo en plan semanal: prep_barra (manual), servicio_barra o servicio_delivery (auto al pasar hora_fin).';
