-- Precio por línea de compra, para poder calcular gasto real (no solo cantidades).
-- Ejecutá en Supabase → SQL Editor si ves: "Could not find the 'precio_unitario' column..."

alter table public.compras_historial
  add column if not exists precio_unitario numeric,
  add column if not exists importe_total numeric;

comment on column public.compras_historial.precio_unitario is
  'Precio por unidad de compra en el momento de esa línea (opcional, referencia).';
comment on column public.compras_historial.importe_total is
  'Importe total gastado en esa línea (cantidad × precio unitario, o cargado directo). Fuente de verdad para gasto.';
