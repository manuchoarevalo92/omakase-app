-- Receta de plato y/o proceso de cocina asociados a cada preparación del plan semanal.
-- Idempotente. RLS ya está en preparaciones (update anon).

alter table public.preparaciones
  add column if not exists receta_plato_id uuid references public.platos(id) on delete set null;

alter table public.preparaciones
  add column if not exists proceso text;

comment on column public.preparaciones.receta_plato_id is
  'Plato cuya receta (public.recetas) se muestra al abrir este bloque en el plan semanal.';
comment on column public.preparaciones.proceso is
  'Pasos operativos de la preparación cuando no hay receta de plato, o como complemento.';

create index if not exists preparaciones_receta_plato_id_idx
  on public.preparaciones (receta_plato_id);

-- Vínculos claros por nombre (receta existente).
update public.preparaciones p
set receta_plato_id = pl.id
from public.platos pl
where pl.nombre = 'Warabi Mochi de Coco'
  and lower(trim(p.nombre)) = 'warabi mochi'
  and p.receta_plato_id is null;

update public.preparaciones p
set receta_plato_id = pl.id
from public.platos pl
where pl.nombre = 'Tamago'
  and lower(trim(p.nombre)) = 'tamago'
  and p.receta_plato_id is null;
