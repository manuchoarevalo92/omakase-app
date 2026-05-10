-- Ampliar proveedores permitidos (Vila Viniteca, Vinalia). Ejecutá en SQL Editor si la tabla ya existía
-- con el CHECK viejo de 5 valores.

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.pedidos_proveedores
  add constraint pedidos_proveedores_proveedor_check
  check (
    proveedor in (
      'Cominport',
      'Arrom',
      'García de Pou',
      'Verdulería',
      'Supermercado',
      'Vila Viniteca',
      'Vinalia'
    )
  );
