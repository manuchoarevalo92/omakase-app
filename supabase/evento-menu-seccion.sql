-- Sección de cada ítem del menú (Omakase 17 pases + extras).
-- Idempotente.

alter table public.evento_menu_items
  add column if not exists seccion text;

alter table public.evento_menu_items
  drop constraint if exists evento_menu_items_seccion_check;

alter table public.evento_menu_items
  add constraint evento_menu_items_seccion_check
  check (
    seccion is null
    or seccion in ('otsumami', 'regalo', 'nigiri', 'postre', 'extra')
  );

comment on column public.evento_menu_items.seccion is
  'Slot del menú Omakase: otsumami | regalo | nigiri | postre | extra.';

create index if not exists evento_menu_items_seccion_idx
  on public.evento_menu_items (evento_id, seccion, orden);
