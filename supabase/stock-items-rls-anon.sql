-- Políticas RLS para que la app (rol anon) pueda ver y editar el catálogo de Stock.
-- Ejecutá en Supabase → SQL Editor si ves:
--   "new row violates row-level security policy for table stock_items"
-- o la lista de Stock queda vacía sin error.

alter table public.stock_items enable row level security;

drop policy if exists "stock_items_select_anon" on public.stock_items;
drop policy if exists "stock_items_insert_anon" on public.stock_items;
drop policy if exists "stock_items_update_anon" on public.stock_items;
drop policy if exists "stock_items_delete_anon" on public.stock_items;

create policy "stock_items_select_anon"
  on public.stock_items for select
  to anon
  using (true);

create policy "stock_items_insert_anon"
  on public.stock_items for insert
  to anon
  with check (true);

create policy "stock_items_update_anon"
  on public.stock_items for update
  to anon
  using (true)
  with check (true);

create policy "stock_items_delete_anon"
  on public.stock_items for delete
  to anon
  using (true);
