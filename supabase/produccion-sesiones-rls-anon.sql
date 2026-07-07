-- Políticas RLS para sesiones de producción (rol anon).

alter table public.produccion_sesiones enable row level security;

drop policy if exists "produccion_sesiones_select_anon" on public.produccion_sesiones;
drop policy if exists "produccion_sesiones_insert_anon" on public.produccion_sesiones;
drop policy if exists "produccion_sesiones_update_anon" on public.produccion_sesiones;
drop policy if exists "produccion_sesiones_delete_anon" on public.produccion_sesiones;

create policy "produccion_sesiones_select_anon"
  on public.produccion_sesiones for select
  to anon
  using (true);

create policy "produccion_sesiones_insert_anon"
  on public.produccion_sesiones for insert
  to anon
  with check (true);

create policy "produccion_sesiones_update_anon"
  on public.produccion_sesiones for update
  to anon
  using (true)
  with check (true);

create policy "produccion_sesiones_delete_anon"
  on public.produccion_sesiones for delete
  to anon
  using (true);
