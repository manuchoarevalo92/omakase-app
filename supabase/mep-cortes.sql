-- Catálogo de cortes para la MEP del delivery (mise en place de pescado).
-- Alimenta /mep-cortes (CRUD) y /mep-deli (carga de cantidades).
-- Idempotente.

create table if not exists public.mep_cortes (
  id uuid primary key default gen_random_uuid(),
  pescado text not null,
  nombre text not null,
  unidad text not null default 'g',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mep_cortes
  drop constraint if exists mep_cortes_unidad_check;

alter table public.mep_cortes
  add constraint mep_cortes_unidad_check
  check (unidad in ('g', 'kg', 'ud', 'porciones'));

drop index if exists public.mep_cortes_pescado_nombre_unq;

create unique index if not exists mep_cortes_pescado_nombre_unq
  on public.mep_cortes (lower(pescado), lower(nombre));

create index if not exists mep_cortes_activo_idx
  on public.mep_cortes (activo);

comment on table public.mep_cortes is
  'Cortes de pescado del catálogo MEP delivery (ej. Salmón · Lomo, Atún · Belly).';
comment on column public.mep_cortes.pescado is
  'Especie o pescado base para agrupar en la UI.';
comment on column public.mep_cortes.nombre is
  'Nombre del corte o preparación (ej. Lomo, Tataki, Nigiri).';
comment on column public.mep_cortes.unidad is
  'Unidad por defecto al cargar cantidades: g, kg, ud, porciones.';

-- Semilla inicial (solo si la tabla está vacía).
insert into public.mep_cortes (pescado, nombre, unidad, orden)
select v.pescado, v.nombre, v.unidad, v.orden
from (
  values
    ('Salmón', 'Lomo', 'g', 10),
    ('Salmón', 'Belly', 'g', 20),
    ('Salmón', 'Nigiri', 'ud', 30),
    ('Atún rojo', 'Lomo', 'g', 40),
    ('Atún rojo', 'Belly', 'g', 50),
    ('Atún rojo', 'Nigiri', 'ud', 60),
    ('Atún rojo', 'Tataki', 'g', 70),
    ('Caballa', 'Filete', 'g', 80),
    ('Virrey', 'Lomo', 'g', 90),
    ('Besugo', 'Lomo', 'g', 100)
) as v(pescado, nombre, unidad, orden)
where not exists (select 1 from public.mep_cortes limit 1);
