-- Políticas RLS para registros de MEP delivery (rol anon).

alter table public.mep_deli_cargas enable row level security;

drop policy if exists "mep_deli_cargas_select_anon" on public.mep_deli_cargas;
drop policy if exists "mep_deli_cargas_insert_anon" on public.mep_deli_cargas;
drop policy if exists "mep_deli_cargas_update_anon" on public.mep_deli_cargas;
drop policy if exists "mep_deli_cargas_delete_anon" on public.mep_deli_cargas;

create policy "mep_deli_cargas_select_anon"
  on public.mep_deli_cargas for select
  to anon
  using (true);

create policy "mep_deli_cargas_insert_anon"
  on public.mep_deli_cargas for insert
  to anon
  with check (true);

create policy "mep_deli_cargas_update_anon"
  on public.mep_deli_cargas for update
  to anon
  using (true)
  with check (true);

create policy "mep_deli_cargas_delete_anon"
  on public.mep_deli_cargas for delete
  to anon
  using (true);
