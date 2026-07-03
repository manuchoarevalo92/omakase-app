-- Tabla de pedidos por proveedor para la pantalla Pedidos.
-- Guarda un snapshot editable por proveedor (items + cantidad + unidad).

create table if not exists public.pedidos_proveedores (
  proveedor text primary key,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pedidos_proveedores_proveedor_check
    check (
      proveedor in (
      'Cominport',
      'Arrom',
      'Pescaderías Coruñesas',
      'García de Pou',
      'Nishikidori',
      'Verdulería',
        'Supermercado',
        'Vila Viniteca',
        'Vinalia'
      )
    )
);

comment on table public.pedidos_proveedores is
  'Pedidos por proveedor cargados desde la app.';
