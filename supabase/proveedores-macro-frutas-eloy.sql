-- Renombrar proveedores genéricos a los reales:
--   Supermercado → Macro
--   Verdulería / Verdurería → Frutas Eloy
-- Amazon (botellitas) y García de Pou (descartables) ya estaban en el CHECK.
-- También asigna proveedor a ítems de stock que estaban en NULL.
-- Idempotente.

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_check;

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_check;

update public.stock_items
set proveedor = 'Macro'
where proveedor = 'Supermercado';

update public.stock_items
set proveedor = 'Frutas Eloy'
where proveedor in ('Verdulería', 'Verdurería');

update public.compras_historial
set proveedor = 'Macro'
where proveedor = 'Supermercado';

update public.compras_historial
set proveedor = 'Frutas Eloy'
where proveedor in ('Verdulería', 'Verdurería');

update public.pedidos_log
set proveedor = 'Macro'
where proveedor = 'Supermercado';

update public.pedidos_log
set proveedor = 'Frutas Eloy'
where proveedor in ('Verdulería', 'Verdurería');

update public.pedidos_proveedores
set proveedor = 'Macro'
where proveedor = 'Supermercado'
  and not exists (
    select 1 from public.pedidos_proveedores x where x.proveedor = 'Macro'
  );

update public.pedidos_proveedores
set proveedor = 'Frutas Eloy'
where proveedor in ('Verdulería', 'Verdurería')
  and not exists (
    select 1 from public.pedidos_proveedores x where x.proveedor = 'Frutas Eloy'
  );

delete from public.pedidos_proveedores
where proveedor in ('Supermercado', 'Verdulería', 'Verdurería');

-- Ítems sin proveedor: descartables → García de Pou; resto típico de Macro.
update public.stock_items
set proveedor = 'García de Pou'
where lower(trim(nombre)) = 'donburi envases'
  and proveedor is null;

update public.stock_items
set proveedor = 'Macro'
where proveedor is null
  and lower(trim(nombre)) in (
    'carbonero',
    'limpiador de baño desinfectante'
  );

insert into public.pedidos_proveedores (proveedor, items)
values
  ('Macro', '[]'::jsonb),
  ('Frutas Eloy', '[]'::jsonb)
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
      'Macro',
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
      'Macro',
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
      'Macro',
      'Vila Viniteca',
      'Vinalia'
    )
  );
