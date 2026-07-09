-- Columna para ocultar preparaciones ya categorizadas en Tiempos prep.
-- No marca nada como confirmado: cada prep se confirma manualmente en la app.

alter table public.preparaciones
  add column if not exists categoria_plan_confirmada boolean not null default false;

comment on column public.preparaciones.categoria_plan_confirmada is
  'true cuando la categoría Produ/Servicio ya fue confirmada en Tiempos prep.';
