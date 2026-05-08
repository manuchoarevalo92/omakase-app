-- Políticas RLS para que la app (rol anon) pueda leer y editar pedidos_proveedores.

alter table public.pedidos_proveedores enable row level security;

drop policy if exists "pedidos_proveedores_select_anon" on public.pedidos_proveedores;
drop policy if exists "pedidos_proveedores_insert_anon" on public.pedidos_proveedores;
drop policy if exists "pedidos_proveedores_update_anon" on public.pedidos_proveedores;
drop policy if exists "pedidos_proveedores_delete_anon" on public.pedidos_proveedores;

create policy "pedidos_proveedores_select_anon"
  on public.pedidos_proveedores for select
  to anon
  using (true);

create policy "pedidos_proveedores_insert_anon"
  on public.pedidos_proveedores for insert
  to anon
  with check (true);

create policy "pedidos_proveedores_update_anon"
  on public.pedidos_proveedores for update
  to anon
  using (true)
  with check (true);

create policy "pedidos_proveedores_delete_anon"
  on public.pedidos_proveedores for delete
  to anon
  using (true);
