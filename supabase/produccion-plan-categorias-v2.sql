-- Nuevas categorías del plan: prep_barra, servicio_barra, servicio_delivery.
-- Ejecutar después de preparaciones-categoria-plan.sql si ya tenías produ/servicio.

alter table public.produccion_plan
  drop constraint if exists produccion_plan_categoria_check;

-- Migrar valores viejos antes del nuevo check
update public.produccion_plan
set categoria = 'prep_barra'
where categoria = 'produ';

update public.produccion_plan p
set categoria = case
  when coalesce(pr.area, 'delivery') = 'delivery' then 'servicio_delivery'
  else 'servicio_barra'
end
from public.preparaciones pr
where p.preparacion_id = pr.id
  and p.categoria = 'servicio';

-- Sincronizar todo el plan desde la preparación (fuente de verdad)
update public.produccion_plan p
set categoria = pr.categoria_plan
from public.preparaciones pr
where p.preparacion_id = pr.id;

alter table public.produccion_plan
  add constraint produccion_plan_categoria_check
  check (categoria in ('prep_barra', 'servicio_barra', 'servicio_delivery'));

comment on column public.produccion_plan.categoria is
  'Copia de preparaciones.categoria_plan; se actualiza al cambiar la preparación en Tiempos prep.';
