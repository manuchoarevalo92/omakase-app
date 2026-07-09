-- Simplifica categorías del plan a produ y servicio.
-- Ejecutar si ya corriste produccion-plan-categorias-v2.sql (prep_barra / servicio_*).

alter table public.produccion_plan
  drop constraint if exists produccion_plan_categoria_check;

alter table public.preparaciones
  drop constraint if exists preparaciones_categoria_plan_check;

update public.preparaciones
set categoria_plan = 'produ'
where categoria_plan in ('prep_barra', 'produ');

update public.preparaciones
set categoria_plan = 'servicio'
where categoria_plan in ('servicio_barra', 'servicio_delivery', 'servicio');

update public.produccion_plan
set categoria = 'produ'
where categoria in ('prep_barra', 'produ');

update public.produccion_plan
set categoria = 'servicio'
where categoria in ('servicio_barra', 'servicio_delivery', 'servicio');

-- Sincronizar plan desde preparaciones (fuente de verdad)
update public.produccion_plan p
set categoria = pr.categoria_plan
from public.preparaciones pr
where p.preparacion_id = pr.id;

alter table public.preparaciones
  add constraint preparaciones_categoria_plan_check
  check (categoria_plan in ('produ', 'servicio'));

alter table public.produccion_plan
  add constraint produccion_plan_categoria_check
  check (categoria in ('produ', 'servicio'));

comment on column public.produccion_plan.categoria is
  'Copia de preparaciones.categoria_plan: produ (manual) o servicio (auto).';
