-- Nikiri barra = receta de Manu (ya estaba).
-- Soja(Nikiri) delivery pasa a llamarse Nikiri delivery: es la soja del equipo, no reservada.
-- Su delivery sigue siendo del delivery (sin receta_solo_admin).
-- Idempotente.

update public.preparaciones
set receta_solo_admin = true
where nombre = 'Nikiri' and area = 'barra';

update public.preparaciones p
set nombre = 'Nikiri',
    receta_solo_admin = false
where p.nombre = 'Soja(Nikiri)'
  and p.area = 'delivery'
  and not exists (
    select 1 from public.preparaciones x
    where x.nombre = 'Nikiri' and x.area = 'delivery' and x.id <> p.id
  );

update public.produccion_plan pp
set preparacion_nombre = pr.nombre
from public.preparaciones pr
where pp.preparacion_id = pr.id
  and pr.nombre = 'Nikiri'
  and pr.area = 'delivery';

update public.produccion_sesiones s
set preparacion_nombre = pr.nombre
from public.preparaciones pr
where s.preparacion_id = pr.id
  and pr.nombre = 'Nikiri'
  and pr.area = 'delivery';

update public.preparaciones
set receta_solo_admin = false
where nombre = 'Su' and area = 'delivery';
