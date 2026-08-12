-- Segundo check: cargado en la valija.
-- Idempotente.

alter table public.evento_checklist_items
  add column if not exists en_valija boolean;

update public.evento_checklist_items
set en_valija = false
where en_valija is null;

alter table public.evento_checklist_items
  alter column en_valija set default false;

alter table public.evento_checklist_items
  alter column en_valija set not null;

comment on column public.evento_checklist_items.en_valija is
  'True cuando el ítem ya está cargado en la valija / transporte.';
