-- Políticas RLS para que la app (rol anon) pueda ver y editar platos.
-- Ejecutá en Supabase → SQL Editor si falla crear/editar/borrar platos.

alter table public.platos enable row level security;

drop policy if exists "platos_select_anon" on public.platos;
drop policy if exists "platos_insert_anon" on public.platos;
drop policy if exists "platos_update_anon" on public.platos;
drop policy if exists "platos_delete_anon" on public.platos;

create policy "platos_select_anon"
  on public.platos for select
  to anon
  using (true);

create policy "platos_insert_anon"
  on public.platos for insert
  to anon
  with check (true);

create policy "platos_update_anon"
  on public.platos for update
  to anon
  using (true)
  with check (true);

create policy "platos_delete_anon"
  on public.platos for delete
  to anon
  using (true);
