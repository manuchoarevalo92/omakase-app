-- Categoría de actividad en el plan semanal: produ (manual) o servicio (auto al pasar el horario).
-- Ejecutar en Supabase si la tabla ya existe sin esta columna.

alter table public.produccion_plan
  add column if not exists categoria text not null default 'produ';

alter table public.produccion_plan
  drop constraint if exists produccion_plan_categoria_check;

alter table public.produccion_plan
  add constraint produccion_plan_categoria_check
  check (categoria in ('produ', 'servicio'));

comment on column public.produccion_plan.categoria is
  'produ: se marca hecha manualmente. servicio: se completa sola al pasar hora_fin.';
