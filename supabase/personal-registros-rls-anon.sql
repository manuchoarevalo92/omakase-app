-- RLS para ficha de personal (app usa rol anon).
-- Nota: la restricción real "solo Manu" se aplica a nivel app/sesión,
-- porque esta app no usa auth JWT por usuario en Supabase.

alter table public.personal_registros enable row level security;

drop policy if exists "personal_registros_select_anon" on public.personal_registros;
drop policy if exists "personal_registros_insert_anon" on public.personal_registros;
drop policy if exists "personal_registros_update_anon" on public.personal_registros;
drop policy if exists "personal_registros_delete_anon" on public.personal_registros;

create policy "personal_registros_select_anon"
  on public.personal_registros for select
  to anon
  using (true);

create policy "personal_registros_insert_anon"
  on public.personal_registros for insert
  to anon
  with check (true);

create policy "personal_registros_update_anon"
  on public.personal_registros for update
  to anon
  using (true)
  with check (true);

create policy "personal_registros_delete_anon"
  on public.personal_registros for delete
  to anon
  using (true);
