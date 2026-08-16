-- Recetas reservadas a Manu (además de Warabi Mochi).
-- Niitsume no existía en el catálogo: se da de alta en barra.
-- Idempotente.

insert into public.preparaciones (
  nombre, area, categoria_plan, categoria_plan_confirmada,
  duracion_dias, receta_solo_admin, seguimiento_activo, pendiente
)
values (
  'Niitsume', 'barra', 'produ', true,
  7, true, true, false
)
on conflict (lower(nombre), area) do update
set receta_solo_admin = true;

update public.preparaciones
set receta_solo_admin = true
where
  (nombre = 'Tosazu' and area = 'barra')
  or (nombre = 'Nikiri' and area = 'barra')
  or (nombre = 'Zu' and area = 'barra')
  or (nombre = 'Tofu' and area = 'barra')
  or (nombre = 'Niitsume' and area = 'barra')
  or (nombre = 'Carabineros + Manteca de Koji' and area = 'barra')
  or (nombre = 'Warabi Mochi' and area = 'barra');
