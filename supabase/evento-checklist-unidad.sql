-- Tipo de unidad en checklist de eventos (unidad, caja, saku, porción…).
-- Idempotente.

alter table public.evento_checklist_items
  add column if not exists unidad text;

update public.evento_checklist_items
set unidad = 'unidad'
where unidad is null or trim(unidad) = '' or unidad = 'ud';

update public.evento_checklist_items
set unidad = 'saku'
where lower(trim(unidad)) = 'saco';

alter table public.evento_checklist_items
  alter column unidad set default 'unidad';

comment on column public.evento_checklist_items.unidad is
  'Tipo de unidad: unidad, caja, saku, porción, etc.';
