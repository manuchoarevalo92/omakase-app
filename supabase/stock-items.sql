-- Catálogo de materia prima que se compra a proveedores ("Stock"), separado del
-- catálogo de ingredientes de menú (public.ingredientes). Alimenta la pantalla
-- /stock y las predicciones de compra de /compras.

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text not null default 'Despensa/Prep',
  proveedor text,
  unidad_compra text not null default 'Unidad',
  buffer_pct integer not null default 15,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stock_items_proveedor_check
    check (
      proveedor is null or proveedor in (
        'Cominport',
        'Arrom',
        'Pescaderías Coruñesas',
      'García de Pou',
      'Nishikidori',
      'Amazon',
      'Frutas Eloy',
      'MAKRO',
      'BBQ FLAVOUR',
      'Vila Viniteca',
      'Vinalia'
      )
    ),
  constraint stock_items_unidad_compra_check
    check (unidad_compra in ('Caja', 'Kilo', 'Unidad')),
  constraint stock_items_buffer_pct_check
    check (buffer_pct between 0 and 100)
);

create unique index if not exists stock_items_nombre_unq
  on public.stock_items (lower(nombre));

comment on table public.stock_items is
  'Catálogo de materia prima / stock que se compra a proveedores. Separado de ingredientes (disponibilidad de menú).';
comment on column public.stock_items.rubro is
  'Pescado/Marisco | Fruta/Vegetal | Despensa/Prep (mismas categorías que ingredientes).';
comment on column public.stock_items.buffer_pct is
  'Margen de seguridad (10-20%, default 15) aplicado al intervalo típico de compra para adelantar el recordatorio.';
