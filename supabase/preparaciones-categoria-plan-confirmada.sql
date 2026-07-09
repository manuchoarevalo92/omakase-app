-- Oculta preparaciones ya categorizadas en Tiempos prep (categoria_plan_confirmada).
-- Las existentes quedan confirmadas para no volver a pedir categoría.

alter table public.preparaciones
  add column if not exists categoria_plan_confirmada boolean not null default false;

update public.preparaciones
set categoria_plan_confirmada = true
where categoria_plan_confirmada = false;

comment on column public.preparaciones.categoria_plan_confirmada is
  'true cuando la categoría Produ/Servicio ya fue confirmada en Tiempos prep.';
