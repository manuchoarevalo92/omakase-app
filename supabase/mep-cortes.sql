-- Catálogo MEP delivery: categorías libres + ítems con cantidad.
-- Alimenta /mep-cortes (CRUD) y /mep-deli (carga de cantidades).
-- Idempotente.

create table if not exists public.mep_cortes (
  id uuid primary key default gen_random_uuid(),
  categoria text not null default 'General',
  nombre text not null,
  unidad text not null default 'g',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migración desde versión con pescado (instalaciones previas)
alter table public.mep_cortes
  add column if not exists categoria text;

alter table public.mep_cortes
  add column if not exists pescado text;

update public.mep_cortes
set categoria = coalesce(nullif(trim(categoria), ''), nullif(trim(pescado), ''), 'General')
where categoria is null or trim(categoria) = '';

alter table public.mep_cortes
  alter column categoria set default 'General';

alter table public.mep_cortes
  alter column categoria set not null;

alter table public.mep_cortes
  drop constraint if exists mep_cortes_unidad_check;

alter table public.mep_cortes
  add constraint mep_cortes_unidad_check
  check (unidad in ('g', 'kg', 'ud', 'porciones'));

drop index if exists public.mep_cortes_pescado_nombre_unq;

create unique index if not exists mep_cortes_categoria_nombre_unq
  on public.mep_cortes (lower(categoria), lower(nombre));

create index if not exists mep_cortes_activo_idx
  on public.mep_cortes (activo);

create index if not exists mep_cortes_categoria_idx
  on public.mep_cortes (lower(categoria));

comment on table public.mep_cortes is
  'Catálogo MEP delivery: categorías libres (Nigiri, Sashimi, etc.) e ítems con unidad.';
comment on column public.mep_cortes.categoria is
  'Grupo libre definido por el equipo (ej. Nigiri, Sashimi, Relleno maki).';
comment on column public.mep_cortes.nombre is
  'Ítem dentro de la categoría (ej. Salmón, Atún, Dorada).';
comment on column public.mep_cortes.unidad is
  'Unidad por defecto al cargar cantidades: g, kg, ud, porciones.';

-- Semilla inicial (solo si la tabla está vacía).
insert into public.mep_cortes (categoria, nombre, unidad, orden)
select v.categoria, v.nombre, v.unidad, v.orden
from (
  values
    ('Nigiri', 'Salmón', 'ud', 10),
    ('Nigiri', 'Atún', 'ud', 20),
    ('Nigiri', 'Dorada', 'ud', 30),
    ('Sashimi', 'Salmón', 'g', 40),
    ('Sashimi', 'Atún', 'g', 50),
    ('Sashimi', 'Dorada', 'g', 60),
    ('Relleno maki', 'Salmón', 'g', 70),
    ('Relleno maki', 'Atún', 'g', 80),
    ('Relleno rolls', 'Salmón', 'g', 90),
    ('Relleno rolls', 'Atún', 'g', 100)
) as v(categoria, nombre, unidad, orden)
where not exists (select 1 from public.mep_cortes limit 1);
