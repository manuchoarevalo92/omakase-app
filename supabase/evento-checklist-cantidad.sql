-- Cantidad de unidades en checklist de eventos.
-- Idempotente.

alter table public.evento_checklist_items
  add column if not exists cantidad integer;

update public.evento_checklist_items
set cantidad = 1
where cantidad is null;

alter table public.evento_checklist_items
  alter column cantidad set default 1;

alter table public.evento_checklist_items
  alter column cantidad set not null;

alter table public.evento_checklist_items
  drop constraint if exists evento_checklist_items_cantidad_check;

alter table public.evento_checklist_items
  add constraint evento_checklist_items_cantidad_check
  check (cantidad > 0);

comment on column public.evento_checklist_items.cantidad is
  'Cantidad de unidades a llevar / preparar.';
