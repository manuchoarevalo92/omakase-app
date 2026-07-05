-- MEP: agrupar ítems por categoría libre (Nigiri, Sashimi, Relleno maki, etc.)
-- Ejecutá si mep_cortes ya existía con la columna pescado.
-- Idempotente.

alter table public.mep_cortes
  add column if not exists categoria text;

-- Filas viejas: muchas quedaron categoria='General' por el DEFAULT al agregar la columna.
-- Si tienen pescado, la categoría real es el pescado (especie / grupo anterior).
update public.mep_cortes
set categoria = nullif(trim(pescado), '')
where pescado is not null
  and trim(pescado) <> ''
  and (
    categoria is null
    or trim(categoria) = ''
    or lower(trim(categoria)) = 'general'
  );

update public.mep_cortes
set categoria = 'General'
where categoria is null or trim(categoria) = '';

-- Quitar duplicados (categoria, nombre): conservar el más antiguo.
delete from public.mep_cortes
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(trim(categoria)), lower(trim(nombre))
        order by created_at asc nulls last, id asc
      ) as rn
    from public.mep_cortes
  ) ranked
  where rn > 1
);

alter table public.mep_cortes
  alter column categoria set default 'General';

alter table public.mep_cortes
  alter column categoria set not null;

alter table public.mep_cortes
  alter column pescado drop not null;

drop index if exists public.mep_cortes_pescado_nombre_unq;

create unique index if not exists mep_cortes_categoria_nombre_unq
  on public.mep_cortes (lower(categoria), lower(nombre));

create index if not exists mep_cortes_categoria_idx
  on public.mep_cortes (lower(categoria));

comment on column public.mep_cortes.categoria is
  'Grupo libre definido por el equipo (ej. Nigiri, Sashimi, Relleno maki).';
comment on column public.mep_cortes.nombre is
  'Ítem dentro de la categoría (ej. Salmón, Atún, Dorada).';
