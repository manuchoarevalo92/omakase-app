-- Políticas RLS para que la app (rol anon) pueda ver y registrar pedidos enviados.

alter table public.pedidos_log enable row level security;

drop policy if exists "pedidos_log_select_anon" on public.pedidos_log;
drop policy if exists "pedidos_log_insert_anon" on public.pedidos_log;
drop policy if exists "pedidos_log_delete_anon" on public.pedidos_log;

create policy "pedidos_log_select_anon"
  on public.pedidos_log for select
  to anon
  using (true);

create policy "pedidos_log_insert_anon"
  on public.pedidos_log for insert
  to anon
  with check (true);

create policy "pedidos_log_delete_anon"
  on public.pedidos_log for delete
  to anon
  using (true);
