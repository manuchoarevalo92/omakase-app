-- Recetas que solo ve el admin (p. ej. Warabi Mochi), aunque el bloque esté
-- asignado a otra persona o alguien intente abrirlo.
alter table public.preparaciones
  add column if not exists receta_solo_admin boolean not null default false;

comment on column public.preparaciones.receta_solo_admin is
  'Si true, Javi/Santi no ven receta ni proceso de esta prep; solo el admin.';

update public.preparaciones
set receta_solo_admin = true
where lower(trim(nombre)) = 'warabi mochi';
