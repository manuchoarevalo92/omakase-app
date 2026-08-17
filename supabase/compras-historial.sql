-- Historial de compras reales (una fila por línea de albarán/pedido) para cada
-- ítem de public.stock_items. A partir de las fechas y cantidades acá cargadas,
-- la pantalla /compras calcula cada cuánto conviene volver a pedir cada ítem.

create table if not exists public.compras_historial (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid references public.stock_items(id) on delete set null,
  stock_item_nombre text not null,
  proveedor text,
  cantidad numeric,
  unidad text not null default 'Unidad',
  fecha date not null,
  origen text not null default 'import',
  created_at timestamptz not null default now(),
  constraint compras_historial_proveedor_check
    check (
      proveedor is null or proveedor in (
        'Cominport',
        'Arrom',
        'Pescaderías Coruñesas',
      'García de Pou',
      'Nishikidori',
      'Isse Japan',
      'Amazon',
      'Frutas Eloy',
      'MAKRO',
      'BBQ FLAVOUR',
      'Vila Viniteca',
      'Vinalia',
      'Salvioni y Alomar'
      )
    ),
  constraint compras_historial_unidad_check
    check (unidad in ('Caja', 'Kilo', 'Unidad')),
  constraint compras_historial_origen_check
    check (origen in ('import', 'manual', 'pedido_enviado'))
);

create index if not exists compras_historial_stock_item_fecha_idx
  on public.compras_historial (stock_item_id, fecha);

comment on table public.compras_historial is
  'Registro histórico de compras (una fila por línea de albarán/pedido) usado para proyectar cada cuánto comprar cada ítem de stock.';
comment on column public.compras_historial.origen is
  'import (albarán histórico pegado a mano) | manual | pedido_enviado (fase 2: auto-registrado desde /pedidos).';
