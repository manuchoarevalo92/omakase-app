-- MEP: agrupar ítems por categoría libre (Nigiri, Sashimi, Relleno maki, etc.)
-- Ejecutá si mep_cortes ya existía con la columna pescado.

alter table public.mep_cortes
  add column if not exists categoria text;

update public.mep_cortes
set categoria = coalesce(nullif(trim(categoria), ''), nullif(trim(pescado), ''), 'General')
where categoria is null or trim(categoria) = '';

alter table public.mep_cortes
  alter column categoria set default 'General';

alter table public.mep_cortes
  alter column categoria set not null;

drop index if exists public.mep_cortes_pescado_nombre_unq;

create unique index if not exists mep_cortes_categoria_nombre_unq
  on public.mep_cortes (lower(categoria), lower(nombre));

create index if not exists mep_cortes_categoria_idx
  on public.mep_cortes (lower(categoria));

comment on column public.mep_cortes.categoria is
  'Grupo libre definido por el equipo (ej. Nigiri, Sashimi, Relleno maki).';
comment on column public.mep_cortes.nombre is
  'Ítem dentro de la categoría (ej. Salmón, Atún, Dorada).';
