-- Políticas RLS para plan semanal de producción (rol anon).

alter table public.produccion_bloques enable row level security;
alter table public.produccion_plan enable row level security;

drop policy if exists "produccion_bloques_select_anon" on public.produccion_bloques;
drop policy if exists "produccion_bloques_insert_anon" on public.produccion_bloques;
drop policy if exists "produccion_bloques_update_anon" on public.produccion_bloques;
drop policy if exists "produccion_bloques_delete_anon" on public.produccion_bloques;

create policy "produccion_bloques_select_anon"
  on public.produccion_bloques for select
  to anon
  using (true);

create policy "produccion_bloques_insert_anon"
  on public.produccion_bloques for insert
  to anon
  with check (true);

create policy "produccion_bloques_update_anon"
  on public.produccion_bloques for update
  to anon
  using (true)
  with check (true);

create policy "produccion_bloques_delete_anon"
  on public.produccion_bloques for delete
  to anon
  using (true);

drop policy if exists "produccion_plan_select_anon" on public.produccion_plan;
drop policy if exists "produccion_plan_insert_anon" on public.produccion_plan;
drop policy if exists "produccion_plan_update_anon" on public.produccion_plan;
drop policy if exists "produccion_plan_delete_anon" on public.produccion_plan;

create policy "produccion_plan_select_anon"
  on public.produccion_plan for select
  to anon
  using (true);

create policy "produccion_plan_insert_anon"
  on public.produccion_plan for insert
  to anon
  with check (true);

create policy "produccion_plan_update_anon"
  on public.produccion_plan for update
  to anon
  using (true)
  with check (true);

create policy "produccion_plan_delete_anon"
  on public.produccion_plan for delete
  to anon
  using (true);
