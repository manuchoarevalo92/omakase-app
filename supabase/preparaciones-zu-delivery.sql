-- El vinagre de delivery se llama Zu, no Su.
-- Zu barra sigue siendo receta de Manu; Zu delivery es del equipo.
-- Idempotente.

update public.preparaciones p
set nombre = 'Zu',
    receta_solo_admin = false
where p.nombre = 'Su'
  and p.area = 'delivery'
  and not exists (
    select 1 from public.preparaciones x
    where x.nombre = 'Zu' and x.area = 'delivery' and x.id <> p.id
  );

update public.produccion_plan pp
set preparacion_nombre = pr.nombre
from public.preparaciones pr
where pp.preparacion_id = pr.id
  and pr.nombre = 'Zu'
  and pr.area = 'delivery';

update public.produccion_sesiones s
set preparacion_nombre = pr.nombre
from public.preparaciones pr
where s.preparacion_id = pr.id
  and pr.nombre = 'Zu'
  and pr.area = 'delivery';
