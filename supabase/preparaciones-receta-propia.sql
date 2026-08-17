-- Receta (ingredientes + PAX) vive en la preparación de Tiempos Prep.
-- Idempotente. RLS de preparaciones ya cubre anon.

alter table public.preparaciones
  add column if not exists receta_ingredientes jsonb;

alter table public.preparaciones
  add column if not exists receta_pax integer;

update public.preparaciones
set receta_ingredientes = '[]'::jsonb
where receta_ingredientes is null;

alter table public.preparaciones
  alter column receta_ingredientes set default '[]'::jsonb;

alter table public.preparaciones
  alter column receta_ingredientes set not null;

comment on column public.preparaciones.receta_ingredientes is
  'Ingredientes de la receta de esta preparación. El origen del ítem es Tiempos Prep.';
comment on column public.preparaciones.receta_pax is
  'Rendimiento de referencia (PAX) de la receta de esta preparación.';

-- Copiar recetas de plato ya vinculadas, sin pisar lo que ya estuviera en la prep.
update public.preparaciones p
set
  receta_ingredientes = coalesce(r.ingredientes, '[]'::jsonb),
  receta_pax = r.pax
from public.recetas r
where r.plato_id = p.receta_plato_id
  and p.receta_ingredientes = '[]'::jsonb
  and coalesce(jsonb_array_length(r.ingredientes), 0) > 0;

update public.preparaciones p
set proceso = r.preparacion
from public.recetas r
where r.plato_id = p.receta_plato_id
  and coalesce(trim(p.proceso), '') = ''
  and coalesce(trim(r.preparacion), '') <> '';
