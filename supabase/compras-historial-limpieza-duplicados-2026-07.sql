-- Registro de la limpieza de datos hecha en compras_historial / stock_items
-- el 2026-07-04 (ya aplicada directamente vía API). Este archivo queda como
-- referencia por si hay que repetirla en otro entorno (staging, etc.).
--
-- Contexto: al importar albaranes, algunas líneas quedaron mal emparejadas
-- (mismo stock_item pero con el campo "proveedor" de otro proveedor distinto
-- al del ítem, y un precio que nunca se repite en el resto del historial).
-- Eso generaba "compras fantasma" el mismo día con precio raro.

-- 1) Separar "Guantes negros" en dos ítems: el original quedó para la
--    variante chica/frecuente (~7-9€, compradas de a 2-6 cajas), y se creó
--    un ítem nuevo para la variante de caja grande (~113-115€, de a 1).
insert into public.stock_items (nombre, rubro, proveedor, unidad_compra, buffer_pct, activo)
values ('Guantes negros (caja grande)', 'Despensa/Prep', 'García de Pou', 'Caja', 15, true)
on conflict do nothing;

-- Reasignar las 4 compras de la variante grande al nuevo ítem
-- (fechas 2026-02-17, 2026-03-12, 2026-04-15, 2026-06-01; cantidad 1,
-- precio ~113-115€). Ejecutar reemplazando <NUEVO_ID> por el id insertado
-- arriba si se repite este script a mano.
-- update public.compras_historial
--   set stock_item_id = '<NUEVO_ID>', stock_item_nombre = 'Guantes negros (caja grande)'
--   where id in (
--     '1fcd85b3-ab09-4e9b-9305-68a6b29ebf0c',
--     '54bd2257-d8c5-42ba-9086-43ef2a4c7a58',
--     'cbbe9a1f-4c08-44c3-bebb-ca993e825a29',
--     '9f06516a-2cb6-48b2-b3c0-9c579d615df4'
--   );

-- 2) Borrar filas erróneas: mismo ítem y misma fecha que otra compra válida,
--    con "proveedor" distinto al proveedor real del ítem y precio que no se
--    repite nunca más en el historial (indicio de línea mal emparejada al
--    importar el albarán).
delete from public.compras_historial
where id in (
  -- Ikura 2026-04-29 (proveedor real: Cominport; estas decían Arrom / Pescaderías Coruñesas)
  'fba15201-f42b-4c69-9019-5d714e61f408',
  '62e7a068-2c8e-4785-9227-5318f6a12e01',
  -- Doradas piscina 2026-05-07 y 2026-05-26 (proveedor real: Arrom; decían Pescaderías Coruñesas)
  '22f00e52-a092-465a-a1c8-8cee55145b45',
  '916908f3-bafd-41f3-8a5b-7ee958e281c6',
  -- Tapas bandejas chicas y Bandejas grandes 2026-04-15 (García de Pou, precio único que no se repite)
  'acb96a0a-fab0-4c21-9b0c-ba8d0c45c31f',
  '1bfad61d-eb7a-4578-9803-75d9d4e1605c'
);
