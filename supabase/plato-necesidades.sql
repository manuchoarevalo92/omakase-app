-- Necesidades operativas por plato (checklist de eventos).
-- Idempotente.

create table if not exists public.plato_necesidades (
  id uuid primary key default gen_random_uuid(),
  plato_id uuid not null references public.platos(id) on delete cascade,
  item text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plato_necesidades_plato_idx
  on public.plato_necesidades (plato_id, orden);

create unique index if not exists plato_necesidades_plato_item_unq
  on public.plato_necesidades (plato_id, lower(trim(item)));

comment on table public.plato_necesidades is
  'Ítems operativos que hace falta por plato (pack / prep / checklist de eventos).';

alter table public.plato_necesidades enable row level security;

drop policy if exists "plato_necesidades_select_anon" on public.plato_necesidades;
drop policy if exists "plato_necesidades_insert_anon" on public.plato_necesidades;
drop policy if exists "plato_necesidades_update_anon" on public.plato_necesidades;
drop policy if exists "plato_necesidades_delete_anon" on public.plato_necesidades;

create policy "plato_necesidades_select_anon"
  on public.plato_necesidades for select to anon using (true);
create policy "plato_necesidades_insert_anon"
  on public.plato_necesidades for insert to anon with check (true);
create policy "plato_necesidades_update_anon"
  on public.plato_necesidades for update to anon using (true) with check (true);
create policy "plato_necesidades_delete_anon"
  on public.plato_necesidades for delete to anon using (true);
