-- Columna que usa la app en /receta (rendimiento / porciones).
-- Ejecutá esto en Supabase → SQL Editor si ves: "Could not find the 'pax' column of 'recetas'…"

alter table public.recetas
  add column if not exists pax integer;

comment on column public.recetas.pax is 'PAX / porciones que rinden las cantidades de la receta';
