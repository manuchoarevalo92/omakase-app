-- RLS para eventos (app usa rol anon).

alter table public.eventos enable row level security;
alter table public.evento_menu_items enable row level security;
alter table public.evento_checklist_items enable row level security;

drop policy if exists "eventos_select_anon" on public.eventos;
drop policy if exists "eventos_insert_anon" on public.eventos;
drop policy if exists "eventos_update_anon" on public.eventos;
drop policy if exists "eventos_delete_anon" on public.eventos;

create policy "eventos_select_anon"
  on public.eventos for select to anon using (true);
create policy "eventos_insert_anon"
  on public.eventos for insert to anon with check (true);
create policy "eventos_update_anon"
  on public.eventos for update to anon using (true) with check (true);
create policy "eventos_delete_anon"
  on public.eventos for delete to anon using (true);

drop policy if exists "evento_menu_items_select_anon" on public.evento_menu_items;
drop policy if exists "evento_menu_items_insert_anon" on public.evento_menu_items;
drop policy if exists "evento_menu_items_update_anon" on public.evento_menu_items;
drop policy if exists "evento_menu_items_delete_anon" on public.evento_menu_items;

create policy "evento_menu_items_select_anon"
  on public.evento_menu_items for select to anon using (true);
create policy "evento_menu_items_insert_anon"
  on public.evento_menu_items for insert to anon with check (true);
create policy "evento_menu_items_update_anon"
  on public.evento_menu_items for update to anon using (true) with check (true);
create policy "evento_menu_items_delete_anon"
  on public.evento_menu_items for delete to anon using (true);

drop policy if exists "evento_checklist_items_select_anon" on public.evento_checklist_items;
drop policy if exists "evento_checklist_items_insert_anon" on public.evento_checklist_items;
drop policy if exists "evento_checklist_items_update_anon" on public.evento_checklist_items;
drop policy if exists "evento_checklist_items_delete_anon" on public.evento_checklist_items;

create policy "evento_checklist_items_select_anon"
  on public.evento_checklist_items for select to anon using (true);
create policy "evento_checklist_items_insert_anon"
  on public.evento_checklist_items for insert to anon with check (true);
create policy "evento_checklist_items_update_anon"
  on public.evento_checklist_items for update to anon using (true) with check (true);
create policy "evento_checklist_items_delete_anon"
  on public.evento_checklist_items for delete to anon using (true);
