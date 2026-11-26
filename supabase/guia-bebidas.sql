-- Guía de bebidas (/guia-bebidas): fichas, capítulos teóricos, glosario y preguntas de repaso.
-- Idempotente. Incluye RLS + policies para anon (la restricción admin/staff vive en la app)
-- y el bucket público de Storage para las fotos de las botellas.

create table if not exists public.guia_bebidas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  categoria text not null,
  subgrupo text,
  orden integer not null default 0,
  nombre text not null,
  precio text,
  meta text,
  datos jsonb not null default '[]'::jsonb,
  en_sala text,
  minima_intervencion boolean not null default false,
  a_confirmar boolean not null default false,
  foto_url text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guia_bebidas_categoria_check check (
    categoria in ('sake', 'espumoso', 'blanco', 'tinto', 'whisky', 'aperitivo', 'sin-alcohol')
  )
);

create index if not exists guia_bebidas_categoria_orden_idx
  on public.guia_bebidas (categoria, orden);

comment on table public.guia_bebidas is
  'Fichas de la guía de bebidas. datos = array de párrafos (markdown simple: **negrita**, *cursiva*).';

create table if not exists public.guia_capitulos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  area text not null,
  titulo text not null,
  orden integer not null default 0,
  bloques jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.guia_capitulos is
  'Capítulos teóricos e intros de categoría (slug intro-<categoria>). bloques = [{t: h|p|ul|ol|table, ...}].';

create table if not exists public.guia_glosario (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  termino text not null,
  definicion text not null,
  orden integer not null default 0,
  unique (area, termino)
);

create table if not exists public.guia_preguntas (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  pregunta text not null unique,
  orden integer not null default 0
);

alter table public.guia_bebidas enable row level security;
alter table public.guia_capitulos enable row level security;
alter table public.guia_glosario enable row level security;
alter table public.guia_preguntas enable row level security;

do $$
declare
  t text;
  op text;
begin
  foreach t in array array['guia_bebidas', 'guia_capitulos', 'guia_glosario', 'guia_preguntas'] loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_anon_' || op, t);
      if op = 'select' or op = 'delete' then
        execute format('create policy %I on public.%I for %s to anon using (true)', t || '_anon_' || op, t, op);
      elsif op = 'insert' then
        execute format('create policy %I on public.%I for insert to anon with check (true)', t || '_anon_' || op, t);
      else
        execute format('create policy %I on public.%I for update to anon using (true) with check (true)', t || '_anon_' || op, t);
      end if;
    end loop;
  end loop;
end $$;

-- Fotos de las botellas: bucket público de lectura; anon puede subir/reemplazar/borrar solo en este bucket.
insert into storage.buckets (id, name, public)
values ('guia-bebidas', 'guia-bebidas', true)
on conflict (id) do nothing;

drop policy if exists guia_bebidas_fotos_anon_select on storage.objects;
create policy guia_bebidas_fotos_anon_select on storage.objects
  for select to anon using (bucket_id = 'guia-bebidas');

drop policy if exists guia_bebidas_fotos_anon_insert on storage.objects;
create policy guia_bebidas_fotos_anon_insert on storage.objects
  for insert to anon with check (bucket_id = 'guia-bebidas');

drop policy if exists guia_bebidas_fotos_anon_update on storage.objects;
create policy guia_bebidas_fotos_anon_update on storage.objects
  for update to anon using (bucket_id = 'guia-bebidas') with check (bucket_id = 'guia-bebidas');

drop policy if exists guia_bebidas_fotos_anon_delete on storage.objects;
create policy guia_bebidas_fotos_anon_delete on storage.objects
  for delete to anon using (bucket_id = 'guia-bebidas');
