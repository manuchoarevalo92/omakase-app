-- Tamago Castella (barra) y Tamago (barra) son la misma prep.
-- Se conservan Tamago barra (con receta) y Tamago delivery.
-- Idempotente.

update public.produccion_sesiones s
set
  preparacion_id = t.id,
  preparacion_nombre = t.nombre,
  area = t.area
from public.preparaciones t, public.preparaciones c
where t.nombre = 'Tamago'
  and t.area = 'barra'
  and c.nombre = 'Tamago Castella'
  and c.area = 'barra'
  and s.preparacion_id = c.id;

update public.produccion_plan p
set
  preparacion_id = t.id,
  preparacion_nombre = t.nombre,
  area = t.area
from public.preparaciones t, public.preparaciones c
where t.nombre = 'Tamago'
  and t.area = 'barra'
  and c.nombre = 'Tamago Castella'
  and c.area = 'barra'
  and p.preparacion_id = c.id;

delete from public.preparaciones
where nombre = 'Tamago Castella'
  and area = 'barra';
