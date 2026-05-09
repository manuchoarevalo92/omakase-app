-- Políticas RLS para historial_servicios: la app usa la anon key (page.tsx insert, historial + rehydrate select).
-- Ejecutá en Supabase → SQL Editor si el menú guarda pero Historial queda vacío, o no se recupera el menú del día.
--
-- Ajustá a tu modelo de seguridad (típico app interna).

alter table public.historial_servicios enable row level security;

drop policy if exists "historial_servicios_select_anon" on public.historial_servicios;
drop policy if exists "historial_servicios_insert_anon" on public.historial_servicios;

create policy "historial_servicios_select_anon"
  on public.historial_servicios for select
  to anon
  using (true);

create policy "historial_servicios_insert_anon"
  on public.historial_servicios for insert
  to anon
  with check (true);
