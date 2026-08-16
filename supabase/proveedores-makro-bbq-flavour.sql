-- Correcciones de proveedores:
--   Macro → MAKRO (cadena de hostelería)
--   Carbonero → Carbón, proveedor BBQ FLAVOUR
-- El limpiador de baño queda en MAKRO.
-- Idempotente.

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_check;

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_check;

update public.stock_items
set nombre = 'Carbón'
where lower(trim(nombre)) = 'carbonero';

update public.stock_items
set proveedor = 'BBQ FLAVOUR'
where lower(trim(nombre)) = 'carbón';

update public.compras_historial
set stock_item_nombre = 'Carbón',
    proveedor = 'BBQ FLAVOUR'
where lower(trim(stock_item_nombre)) in ('carbonero', 'carbón');

update public.stock_items
set proveedor = 'MAKRO'
where proveedor = 'Macro';

update public.compras_historial
set proveedor = 'MAKRO'
where proveedor = 'Macro';

update public.pedidos_log
set proveedor = 'MAKRO'
where proveedor = 'Macro';

update public.pedidos_proveedores
set proveedor = 'MAKRO'
where proveedor = 'Macro'
  and not exists (
    select 1 from public.pedidos_proveedores x where x.proveedor = 'MAKRO'
  );

delete from public.pedidos_proveedores
where proveedor = 'Macro';

insert into public.pedidos_proveedores (proveedor, items)
values
  ('MAKRO', '[]'::jsonb),
  ('BBQ FLAVOUR', '[]'::jsonb)
on conflict (proveedor) do nothing;

alter table public.pedidos_proveedores
  add constraint pedidos_proveedores_proveedor_check
  check (
    proveedor in (
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
      'Amazon',
      'Frutas Eloy',
      'MAKRO',
      'BBQ FLAVOUR',
      'Vila Viniteca',
      'Vinalia'
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
      'Amazon',
      'Frutas Eloy',
      'MAKRO',
      'BBQ FLAVOUR',
      'Vila Viniteca',
      'Vinalia'
    )
  );
