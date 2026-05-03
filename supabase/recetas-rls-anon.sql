-- Políticas RLS para que la app (rol anon) pueda leer y guardar recetas.
-- Ejecutá en Supabase → SQL Editor si ves: "new row violates row-level security policy for table recetas"
--
-- Ajustá la seguridad a tu caso: esto es típico para una app interna con anon key.

alter table public.recetas enable row level security;

-- Quitar políticas viejas con el mismo nombre si re-ejecutás el script
drop policy if exists "recetas_select_anon" on public.recetas;
drop policy if exists "recetas_insert_anon" on public.recetas;
drop policy if exists "recetas_update_anon" on public.recetas;
drop policy if exists "recetas_delete_anon" on public.recetas;

create policy "recetas_select_anon"
  on public.recetas for select
  to anon
  using (true);

create policy "recetas_insert_anon"
  on public.recetas for insert
  to anon
  with check (true);

-- UPDATE: en el asistente de Supabase suelen pedir DOS expresiones:
--   "USING" / "Qual"  → escribí exactamente: true
--   "WITH CHECK"      → escribí exactamente: true
-- (sin comillas alrededor de true; es SQL booleano)
create policy "recetas_update_anon"
  on public.recetas for update
  to anon
  using (true)
  with check (true);

-- Si solo querés probar el UPDATE, pegá esto solo (después del DROP de arriba):
-- drop policy if exists "recetas_update_anon" on public.recetas;
-- create policy "recetas_update_anon" on public.recetas for update to anon using (true) with check (true);

-- Opcional: solo si la UI borra recetas
-- create policy "recetas_delete_anon"
--   on public.recetas for delete
--   to anon
--   using (true);
