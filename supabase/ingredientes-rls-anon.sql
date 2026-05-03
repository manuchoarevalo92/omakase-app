-- Políticas RLS para que la app (rol anon) pueda ver y editar ingredientes.
-- Ejecutá en Supabase → SQL Editor si ves:
--   "new row violates row-level security policy for table ingredientes"
-- o la lista de ingredientes queda vacía sin error.

alter table public.ingredientes enable row level security;

drop policy if exists "ingredientes_select_anon" on public.ingredientes;
drop policy if exists "ingredientes_insert_anon" on public.ingredientes;
drop policy if exists "ingredientes_update_anon" on public.ingredientes;
drop policy if exists "ingredientes_delete_anon" on public.ingredientes;

create policy "ingredientes_select_anon"
  on public.ingredientes for select
  to anon
  using (true);

create policy "ingredientes_insert_anon"
  on public.ingredientes for insert
  to anon
  with check (true);

create policy "ingredientes_update_anon"
  on public.ingredientes for update
  to anon
  using (true)
  with check (true);

create policy "ingredientes_delete_anon"
  on public.ingredientes for delete
  to anon
  using (true);
