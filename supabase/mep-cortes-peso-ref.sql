-- Peso de referencia por corte (pizarra cocina) para mostrar en MEP Deli.
-- Idempotente. Ejecutar en Supabase SQL Editor.

alter table public.mep_cortes
  add column if not exists peso_ref text;

comment on column public.mep_cortes.peso_ref is
  'Peso objetivo / rango de referencia (ej. 15 g, 12/14 g). Solo informativo en la lista MEP.';

-- Cortes de Nigiri · 15 g
update public.mep_cortes
set peso_ref = '15 g'
where categoria = 'Cortes de Nigiri'
  and nombre in ('Salmón', 'Hamachi', 'Akami', 'Chutoro');

-- Cortes de Nigiri · 12/14 g
update public.mep_cortes
set peso_ref = '12/14 g'
where categoria = 'Cortes de Nigiri'
  and nombre in ('Dorada');

-- Cortes de Nigiri · 12/15 g (Ōtoro = Toro de la pizarra)
update public.mep_cortes
set peso_ref = '12/15 g'
where categoria = 'Cortes de Nigiri'
  and nombre in ('Ōtoro');

-- Rolls · Salmón 90 g
update public.mep_cortes
set peso_ref = '90 g'
where categoria = 'Rellenos Rolls/Maki'
  and nombre = 'Salmón';

-- Negitoro 80 g
update public.mep_cortes
set peso_ref = '80 g'
where nombre = 'Negitoro';

-- En la pizarra también figuran Shari 12/13 g, Jurel 12/14 g,
-- Chu Toro (P) / Kama Toro 12/15 g — no están en el catálogo actual.
