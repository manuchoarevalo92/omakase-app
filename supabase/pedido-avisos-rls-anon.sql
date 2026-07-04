-- Políticas RLS para que la app (rol anon) pueda ver y editar avisos de pedido.

alter table public.pedido_avisos enable row level security;

drop policy if exists "pedido_avisos_select_anon" on public.pedido_avisos;
drop policy if exists "pedido_avisos_insert_anon" on public.pedido_avisos;
drop policy if exists "pedido_avisos_update_anon" on public.pedido_avisos;
drop policy if exists "pedido_avisos_delete_anon" on public.pedido_avisos;

create policy "pedido_avisos_select_anon"
  on public.pedido_avisos for select
  to anon
  using (true);

create policy "pedido_avisos_insert_anon"
  on public.pedido_avisos for insert
  to anon
  with check (true);

create policy "pedido_avisos_update_anon"
  on public.pedido_avisos for update
  to anon
  using (true)
  with check (true);

create policy "pedido_avisos_delete_anon"
  on public.pedido_avisos for delete
  to anon
  using (true);
