-- Políticas RLS para que la app (rol anon) pueda leer y editar bebidas_asientos.

alter table public.bebidas_asientos enable row level security;

drop policy if exists "bebidas_asientos_select_anon" on public.bebidas_asientos;
drop policy if exists "bebidas_asientos_insert_anon" on public.bebidas_asientos;
drop policy if exists "bebidas_asientos_update_anon" on public.bebidas_asientos;
drop policy if exists "bebidas_asientos_delete_anon" on public.bebidas_asientos;

create policy "bebidas_asientos_select_anon"
  on public.bebidas_asientos for select
  to anon
  using (true);

create policy "bebidas_asientos_insert_anon"
  on public.bebidas_asientos for insert
  to anon
  with check (true);

create policy "bebidas_asientos_update_anon"
  on public.bebidas_asientos for update
  to anon
  using (true)
  with check (true);

create policy "bebidas_asientos_delete_anon"
  on public.bebidas_asientos for delete
  to anon
  using (true);
