-- Distingue platos de carta (se sirven) de recetas base / procesos (no van al menú).
-- Idempotente. RLS de platos ya cubre anon (select/insert/update/delete).

alter table public.platos
  add column if not exists tipo text;

update public.platos
set tipo = 'carta'
where tipo is null;

alter table public.platos
  alter column tipo set default 'carta';

alter table public.platos
  alter column tipo set not null;

alter table public.platos
  drop constraint if exists platos_tipo_check;

alter table public.platos
  add constraint platos_tipo_check check (tipo in ('carta', 'base'));

comment on column public.platos.tipo is
  'carta = plato que se sirve; base = receta o proceso que no va en el menú (dashi, nikiri, etc.).';

create index if not exists platos_tipo_idx on public.platos (tipo);
