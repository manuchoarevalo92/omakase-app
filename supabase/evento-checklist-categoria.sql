-- Categoría en checklist de eventos (fresco, seco, preparados…).
-- Idempotente.

alter table public.evento_checklist_items
  add column if not exists categoria text;

update public.evento_checklist_items
set categoria = 'otros'
where categoria is null or trim(categoria) = '';

alter table public.evento_checklist_items
  alter column categoria set default 'otros';

comment on column public.evento_checklist_items.categoria is
  'Grupo de packing: fresco, seco, preparados, vajilla, vajilla_servicio, utensilios, equipo, bebidas, logistica, otros';
