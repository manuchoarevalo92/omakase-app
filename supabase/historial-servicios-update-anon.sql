-- historial_servicios: permitir update a anon.
-- Bebidas crea el servicio del turno sin menú (cambio automático a las 19:00 y
-- a las 4:00); al cerrar el menú en Omakase se completa ese mismo registro.
-- Idempotente. RLS ya está activo (historial-servicios-rls-anon.sql).

alter table public.historial_servicios enable row level security;

drop policy if exists "historial_servicios_update_anon" on public.historial_servicios;

create policy "historial_servicios_update_anon"
  on public.historial_servicios for update
  to anon
  using (true)
  with check (true);
