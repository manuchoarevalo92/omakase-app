-- Frecuencia estimada a mano para ítems sin albarán (ej. Amazon), para poder
-- calcular la urgencia de compra con una sola compra registrada en vez de
-- esperar indefinidamente a una segunda. Se carga opcionalmente desde el
-- modal "Registrar" de /compras.
-- Ejecutá en Supabase → SQL Editor si ves: "Could not find the
-- 'intervalo_estimado_dias' column of 'stock_items' in the schema cache".

alter table public.stock_items
  add column if not exists intervalo_estimado_dias integer;

alter table public.stock_items
  drop constraint if exists stock_items_intervalo_estimado_dias_check;

alter table public.stock_items
  add constraint stock_items_intervalo_estimado_dias_check
  check (intervalo_estimado_dias is null or intervalo_estimado_dias > 0);

comment on column public.stock_items.intervalo_estimado_dias is
  'Cada cuántos días aprox. se vuelve a comprar este ítem, cargado a mano. Se usa para calcular la urgencia cuando hay una sola compra registrada (todavía no hay 2+ compras reales para medir el ciclo real).';
