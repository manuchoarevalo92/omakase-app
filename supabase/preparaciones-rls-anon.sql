-- Políticas RLS para que la app (rol anon) pueda ver y editar preparaciones.

alter table public.preparaciones enable row level security;

drop policy if exists "preparaciones_select_anon" on public.preparaciones;
drop policy if exists "preparaciones_insert_anon" on public.preparaciones;
drop policy if exists "preparaciones_update_anon" on public.preparaciones;
drop policy if exists "preparaciones_delete_anon" on public.preparaciones;

create policy "preparaciones_select_anon"
  on public.preparaciones for select
  to anon
  using (true);

create policy "preparaciones_insert_anon"
  on public.preparaciones for insert
  to anon
  with check (true);

create policy "preparaciones_update_anon"
  on public.preparaciones for update
  to anon
  using (true)
  with check (true);

create policy "preparaciones_delete_anon"
  on public.preparaciones for delete
  to anon
  using (true);
