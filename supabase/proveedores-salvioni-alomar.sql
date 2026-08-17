-- Alta de Salvioni y Alomar (soja Mitsuboshi, sake y arroz).
-- Idempotente. RLS ya está en pedidos_proveedores, stock_items y compras_historial.

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_check;

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_check;

alter table public.pedidos_proveedores
  add constraint pedidos_proveedores_proveedor_check
  check (
    proveedor in (
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
  );

alter table public.stock_items
  add constraint stock_items_proveedor_check
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
  );

alter table public.compras_historial
  add constraint compras_historial_proveedor_check
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
  );

insert into public.pedidos_proveedores (proveedor, items)
values ('Salvioni y Alomar', '[]'::jsonb)
on conflict (proveedor) do nothing;

insert into public.stock_items (nombre, rubro, proveedor, unidad_compra, buffer_pct, activo)
values
  ('Soja Mitsuboshi', 'Despensa/Prep', 'Salvioni y Alomar', 'Unidad', 15, true),
  ('Sake', 'Despensa/Prep', 'Salvioni y Alomar', 'Unidad', 15, true),
  ('Arroz', 'Despensa/Prep', 'Salvioni y Alomar', 'Unidad', 15, true)
on conflict (lower(nombre)) do update
set
  proveedor = excluded.proveedor,
  rubro = excluded.rubro,
  activo = true;
