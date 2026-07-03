-- Alta de los ítems y el historial real de compras a "Nishikidori", extraídos de
-- los albaranes (marzo-junio 2026). El proveedor ya estaba habilitado en los
-- CHECK (ver proveedores-nishikidori.sql); acá solo se cargan los ítems y compras.
-- Ejecutá en Supabase → SQL Editor. Es idempotente: si ya corriste este archivo,
-- volver a correrlo no duplica ítems (por nombre) ni compras (por stock_item_id+fecha+cantidad).

insert into public.stock_items (nombre, rubro, proveedor, unidad_compra, buffer_pct, activo)
values
  ('Kiriwarishou (raíz de wasabi fresca) caja 15kg', 'Despensa/Prep', 'Nishikidori', 'Caja', 15, true),
  ('Salsa de soja con sal trufada 180ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Hojas de cerezo sakura saladas x10', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Fécula de kuzu Hon Kuzu 100g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Vinagre de arroz Junmai Fujisu Superior 1800ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Vinagre negro de arroz Genmai 500ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Miso blanco Shiro Miso 100g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Miso blanco vinagreta Sumiso 300g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Miso blanco vinagre y mostaza Karashimiso 300g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Hojas de cerezo sakura en flor saladas x50', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Vinagre rojo Kohaku 1800ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Mirin blanco Shiro 14% 1800ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Saké de cocina Izumo Jidenshu 13% 720ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Honden Tohi Akazaké 12% 300ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Alga Rishiri kombu de Hokkaido 40g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ponzu de cebolleta verde Pon de Dore 200ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Okasumiso de cebolleta Toyama 300g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Salsa Bannou tare vegana con cebollino Toyama 200ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Almidón de patata Katakuriko 500g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Fécula de kuzu Hon Kuzu 1kg', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ciruelas umeboshi 100g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ciruelas umeboshi orgánicas 120g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ma kombu de Shirokuchihama (Hokkaido) 300g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ciruelas umeboshi 1000g', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Vinagre de arroz Junmai Fujisu Superior 900ml', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true),
  ('Ma kombu premium para kombu-jime 1kg', 'Despensa/Prep', 'Nishikidori', 'Unidad', 15, true)
on conflict (lower(nombre)) do nothing;

-- Historial real de compras (una fila por línea de albarán). Líneas repetidas del
-- mismo ítem dentro de un mismo albarán se suman en una sola fila. Los ítems que
-- vinieron como muestra gratis (precio 0 en el albarán) se cargan sin precio.
insert into public.compras_historial
  (stock_item_id, stock_item_nombre, proveedor, cantidad, unidad, fecha, origen, precio_unitario, importe_total)
select
  si.id, c.nombre, 'Nishikidori', c.cantidad, c.unidad, c.fecha::date, 'import', c.precio_unitario, c.importe_total
from (
  values
    ('2026-03-02', 'Kiriwarishou (raíz de wasabi fresca) caja 15kg', 1::numeric, 'Caja', 84.00::numeric, 84.00::numeric),
    ('2026-03-02', 'Salsa de soja con sal trufada 180ml', 1, 'Unidad', null, null),
    ('2026-03-27', 'Hojas de cerezo sakura saladas x10', 1, 'Unidad', 4.65, 4.65),
    ('2026-03-27', 'Fécula de kuzu Hon Kuzu 100g', 1, 'Unidad', 7.30, 7.30),
    ('2026-03-27', 'Salsa de soja con sal trufada 180ml', 1, 'Unidad', null, null),
    ('2026-03-27', 'Vinagre de arroz Junmai Fujisu Superior 1800ml', 3, 'Unidad', 28.70, 86.10),
    ('2026-03-27', 'Vinagre negro de arroz Genmai 500ml', 1, 'Unidad', 21.90, 21.90),
    ('2026-03-27', 'Miso blanco Shiro Miso 100g', 3, 'Unidad', 3.40, 10.20),
    ('2026-03-27', 'Miso blanco vinagreta Sumiso 300g', 3, 'Unidad', 6.90, 20.70),
    ('2026-03-27', 'Miso blanco vinagre y mostaza Karashimiso 300g', 3, 'Unidad', 6.90, 20.70),
    ('2026-03-27', 'Hojas de cerezo sakura en flor saladas x50', 2, 'Unidad', 8.15, 16.30),
    ('2026-03-27', 'Vinagre rojo Kohaku 1800ml', 4, 'Unidad', 17.65, 70.60),
    ('2026-04-08', 'Mirin blanco Shiro 14% 1800ml', 1, 'Unidad', 37.05, 37.05),
    ('2026-04-08', 'Saké de cocina Izumo Jidenshu 13% 720ml', 1, 'Unidad', 15.50, 15.50),
    ('2026-04-08', 'Honden Tohi Akazaké 12% 300ml', 1, 'Unidad', 7.00, 7.00),
    ('2026-04-16', 'Mirin blanco Shiro 14% 1800ml', 1, 'Unidad', 40.75, 40.75),
    ('2026-04-16', 'Saké de cocina Izumo Jidenshu 13% 720ml', 1, 'Unidad', 19.58, 19.58),
    ('2026-04-16', 'Honden Tohi Akazaké 12% 300ml', 1, 'Unidad', 8.75, 8.75),
    ('2026-04-16', 'Alga Rishiri kombu de Hokkaido 40g', 25, 'Unidad', 5.35, 133.75),
    ('2026-04-16', 'Ponzu de cebolleta verde Pon de Dore 200ml', 1, 'Unidad', null, null),
    ('2026-04-16', 'Okasumiso de cebolleta Toyama 300g', 1, 'Unidad', null, null),
    ('2026-04-16', 'Salsa Bannou tare vegana con cebollino Toyama 200ml', 1, 'Unidad', null, null),
    ('2026-05-04', 'Almidón de patata Katakuriko 500g', 2, 'Unidad', 6.55, 13.10),
    ('2026-05-04', 'Fécula de kuzu Hon Kuzu 1kg', 1, 'Unidad', 51.00, 51.00),
    ('2026-05-04', 'Ciruelas umeboshi 100g', 1, 'Unidad', 5.90, 5.90),
    ('2026-05-04', 'Vinagre de arroz Junmai Fujisu Superior 1800ml', 5, 'Unidad', 28.70, 143.50),
    ('2026-05-04', 'Ciruelas umeboshi orgánicas 120g', 4, 'Unidad', 6.20, 24.80),
    ('2026-05-04', 'Vinagre rojo Kohaku 1800ml', 3, 'Unidad', 17.65, 52.95),
    ('2026-05-20', 'Ma kombu de Shirokuchihama (Hokkaido) 300g', 4, 'Unidad', 21.00, 84.00),
    ('2026-05-20', 'Alga Rishiri kombu de Hokkaido 40g', 25, 'Unidad', 5.35, 133.75),
    ('2026-05-20', 'Ciruelas umeboshi 1000g', 2, 'Unidad', 35.95, 71.90),
    ('2026-05-20', 'Vinagre de arroz Junmai Fujisu Superior 900ml', 12, 'Unidad', 15.95, 191.40),
    ('2026-06-24', 'Ma kombu premium para kombu-jime 1kg', 1, 'Unidad', 65.00, 65.00),
    ('2026-06-24', 'Vinagre de arroz Junmai Fujisu Superior 900ml', 12, 'Unidad', 15.95, 191.40),
    ('2026-06-24', 'Miso blanco vinagreta Sumiso 300g', 4, 'Unidad', 6.90, 27.60)
) as c(fecha, nombre, cantidad, unidad, precio_unitario, importe_total)
join public.stock_items si on lower(si.nombre) = lower(c.nombre)
where not exists (
  select 1 from public.compras_historial ch
  where ch.stock_item_id = si.id
    and ch.fecha = c.fecha::date
    and ch.cantidad = c.cantidad
    and ch.origen = 'import'
);
