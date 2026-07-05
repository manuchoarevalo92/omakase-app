-- Políticas RLS para el catálogo de cortes MEP (rol anon).

alter table public.mep_cortes enable row level security;

drop policy if exists "mep_cortes_select_anon" on public.mep_cortes;
drop policy if exists "mep_cortes_insert_anon" on public.mep_cortes;
drop policy if exists "mep_cortes_update_anon" on public.mep_cortes;
drop policy if exists "mep_cortes_delete_anon" on public.mep_cortes;

create policy "mep_cortes_select_anon"
  on public.mep_cortes for select
  to anon
  using (true);

create policy "mep_cortes_insert_anon"
  on public.mep_cortes for insert
  to anon
  with check (true);

create policy "mep_cortes_update_anon"
  on public.mep_cortes for update
  to anon
  using (true)
  with check (true);

create policy "mep_cortes_delete_anon"
  on public.mep_cortes for delete
  to anon
  using (true);
