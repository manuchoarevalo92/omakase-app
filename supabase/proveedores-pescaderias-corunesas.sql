-- Agregar "Pescaderías Coruñesas" a los CHECK de proveedor en las tres tablas.
-- Ejecutá en Supabase → SQL Editor antes de usar /pedidos, /stock o importar albaranes.

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.pedidos_proveedores
  add constraint pedidos_proveedores_proveedor_check
  check (
    proveedor in (
      'Cominport',
      'Arrom',
      'Pescaderías Coruñesas',
      'García de Pou',
      'Verdulería',
      'Supermercado',
      'Vila Viniteca',
      'Vinalia'
    )
  );

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_check;

alter table public.stock_items
  add constraint stock_items_proveedor_check
  check (
    proveedor is null or proveedor in (
      'Cominport',
      'Arrom',
      'Pescaderías Coruñesas',
      'García de Pou',
      'Verdulería',
      'Supermercado',
      'Vila Viniteca',
      'Vinalia'
    )
  );

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_check;

alter table public.compras_historial
  add constraint compras_historial_proveedor_check
  check (
    proveedor is null or proveedor in (
      'Cominport',
      'Arrom',
      'Pescaderías Coruñesas',
      'García de Pou',
      'Verdulería',
      'Supermercado',
      'Vila Viniteca',
      'Vinalia'
    )
  );
