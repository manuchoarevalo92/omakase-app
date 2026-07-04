-- Amplía el rango de asientos de bebidas para incluir los dos extra (-2 y -1),
-- además de los 1..8 originales. Ejecutá en Supabase → SQL Editor si ya tenías
-- bebidas_asientos con el CHECK viejo (asiento between 1 and 8).
-- Idempotente.

alter table public.bebidas_asientos
  drop constraint if exists bebidas_asientos_numero_check;

alter table public.bebidas_asientos
  add constraint bebidas_asientos_numero_check check (asiento between -2 and 8);
