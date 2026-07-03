-- Políticas RLS para que la app (rol anon) pueda ver y cargar historial de compras.
-- Ejecutá en Supabase → SQL Editor si ves:
--   "new row violates row-level security policy for table compras_historial"

alter table public.compras_historial enable row level security;

drop policy if exists "compras_historial_select_anon" on public.compras_historial;
drop policy if exists "compras_historial_insert_anon" on public.compras_historial;
drop policy if exists "compras_historial_update_anon" on public.compras_historial;
drop policy if exists "compras_historial_delete_anon" on public.compras_historial;

create policy "compras_historial_select_anon"
  on public.compras_historial for select
  to anon
  using (true);

create policy "compras_historial_insert_anon"
  on public.compras_historial for insert
  to anon
  with check (true);

create policy "compras_historial_update_anon"
  on public.compras_historial for update
  to anon
  using (true)
  with check (true);

create policy "compras_historial_delete_anon"
  on public.compras_historial for delete
  to anon
  using (true);
