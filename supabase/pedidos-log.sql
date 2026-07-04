-- Log histórico de pedidos enviados. Cada vez que se copia/envía un pedido a un
-- proveedor desde /pedidos se guarda un snapshot de qué y cuánto se pidió, para
-- poder analizar después con qué frecuencia se pide cada cosa (el borrador vivo
-- en pedidos_proveedores se sobreescribe y no sirve como historial).
-- Idempotente.

create table if not exists public.pedidos_log (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  enviado_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  total_items integer not null default 0
);

create index if not exists pedidos_log_proveedor_idx
  on public.pedidos_log (proveedor);

create index if not exists pedidos_log_enviado_at_idx
  on public.pedidos_log (enviado_at);

comment on table public.pedidos_log is
  'Snapshot histórico de cada pedido enviado (copiado) por proveedor. Alimenta el análisis de frecuencia de pedidos.';
comment on column public.pedidos_log.items is
  'Array JSON de las líneas pedidas: [{item, cantidad, unidad}]. Snapshot al momento del envío.';
comment on column public.pedidos_log.total_items is
  'Cantidad de líneas con nombre y cantidad que tenía el pedido al enviarse.';
