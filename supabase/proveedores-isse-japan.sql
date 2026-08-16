-- Alta de "Isse Japan" y de los ítems/compras extraídos de las facturas
-- BL16006, FA17570, FA17837 y FA17871 (BL16437 es el mismo albarán que FA17871).
-- No se carga TRANSPORTE ESPANA. Idempotente.

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
      'Isse Japan',
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
      'Isse Japan',
      'Amazon',
      'Frutas Eloy',
      'MAKRO',
      'BBQ FLAVOUR',
      'Vila Viniteca',
      'Vinalia'
    )
  );

insert into public.pedidos_proveedores (proveedor, items)
values ('Isse Japan', '[]'::jsonb)
on conflict (proveedor) do nothing;

insert into public.stock_items (nombre, rubro, proveedor, unidad_compra, buffer_pct, activo)
values
  ('Shima Aji Ikejime (Ehime)', 'Pescado/Marisco', 'Isse Japan', 'Kilo', 15, true),
  ('Hana Hoshiso (flores de shiso)', 'Fruta/Vegetal', 'Isse Japan', 'Unidad', 15, true),
  ('Kinome', 'Fruta/Vegetal', 'Isse Japan', 'Unidad', 15, true),
  ('Wasabi Azumino', 'Fruta/Vegetal', 'Isse Japan', 'Kilo', 15, true),
  ('Vinagre rojo Yokoi Kohaku Akasu 1.8L', 'Despensa/Prep', 'Isse Japan', 'Unidad', 15, true),
  ('Kombu Rishiri Hokkaido', 'Despensa/Prep', 'Isse Japan', 'Kilo', 15, true),
  ('Wasabi Shizuoka', 'Fruta/Vegetal', 'Isse Japan', 'Kilo', 15, true),
  ('Ao Yuzu', 'Fruta/Vegetal', 'Isse Japan', 'Kilo', 15, true),
  ('Sésamo tostado dorado orgánico 30g', 'Despensa/Prep', 'Isse Japan', 'Unidad', 15, true),
  ('Sésamo tostado blanco orgánico 50g', 'Despensa/Prep', 'Isse Japan', 'Unidad', 15, true),
  ('Myoga Kochi', 'Fruta/Vegetal', 'Isse Japan', 'Unidad', 15, true),
  ('Junsai', 'Despensa/Prep', 'Isse Japan', 'Unidad', 15, true)
on conflict (lower(nombre)) do nothing;

insert into public.compras_historial
  (stock_item_id, stock_item_nombre, proveedor, cantidad, unidad, fecha, origen, precio_unitario, importe_total)
select
  si.id, c.nombre, 'Isse Japan', c.cantidad, c.unidad, c.fecha::date, 'import', c.precio_unitario, c.importe_total
from (
  values
    -- BL16006 (proforma 14/07/2026)
    ('2026-07-14', 'Shima Aji Ikejime (Ehime)', 2.900::numeric, 'Kilo', 45.88::numeric, 133.05::numeric),
    ('2026-07-14', 'Hana Hoshiso (flores de shiso)', 3, 'Unidad', 14.80, 44.40),
    ('2026-07-14', 'Kinome', 1, 'Unidad', 38.88, 38.88),
    ('2026-07-14', 'Wasabi Azumino', 0.500, 'Kilo', 245.00, 122.50),
    ('2026-07-14', 'Vinagre rojo Yokoi Kohaku Akasu 1.8L', 4, 'Unidad', 29.88, 119.52),
    -- FA17570 (17/07/2026, albarán BL16050)
    ('2026-07-17', 'Kombu Rishiri Hokkaido', 1.000, 'Kilo', 149.80, 149.80),
    ('2026-07-17', 'Wasabi Shizuoka', 1.005, 'Kilo', 245.00, 246.23),
    ('2026-07-17', 'Ao Yuzu', 0.515, 'Kilo', 128.88, 66.37),
    ('2026-07-17', 'Sésamo tostado dorado orgánico 30g', 7, 'Unidad', 4.72, 33.04),
    ('2026-07-17', 'Sésamo tostado blanco orgánico 50g', 3, 'Unidad', 2.84, 8.52),
    ('2026-07-17', 'Myoga Kochi', 4, 'Unidad', 5.80, 23.20),
    -- FA17837 (06/08/2026, albarán BL16411) — sin transporte
    ('2026-08-06', 'Wasabi Shizuoka', 0.360, 'Kilo', 245.00, 88.20),
    ('2026-08-06', 'Ao Yuzu', 0.508, 'Kilo', 128.88, 65.47),
    ('2026-08-06', 'Myoga Kochi', 2, 'Unidad', 5.80, 11.60),
    ('2026-08-06', 'Hana Hoshiso (flores de shiso)', 3, 'Unidad', 14.80, 44.40),
    -- FA17871 (09/08/2026, albarán BL16437) — no se duplica la proforma
    ('2026-08-09', 'Junsai', 4, 'Unidad', 18.80, 75.20),
    ('2026-08-09', 'Ao Yuzu', 0.530, 'Kilo', 128.88, 68.31),
    ('2026-08-09', 'Myoga Kochi', 3, 'Unidad', 5.80, 17.40),
    ('2026-08-09', 'Hana Hoshiso (flores de shiso)', 3, 'Unidad', 14.80, 44.40),
    ('2026-08-09', 'Wasabi Shizuoka', 1.080, 'Kilo', 245.00, 264.60)
) as c(fecha, nombre, cantidad, unidad, precio_unitario, importe_total)
join public.stock_items si on lower(si.nombre) = lower(c.nombre)
where not exists (
  select 1 from public.compras_historial ch
  where ch.stock_item_id = si.id
    and ch.fecha = c.fecha::date
    and ch.cantidad = c.cantidad
    and ch.origen = 'import'
);
