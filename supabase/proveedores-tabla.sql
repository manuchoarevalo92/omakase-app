-- Catálogo de proveedores editable desde la app (Avisos / Stock / Pedidos).
-- Reemplaza los CHECK fijos. RLS en la misma migración. Idempotente.

create table if not exists public.proveedores (
  nombre text primary key,
  created_at timestamptz not null default now(),
  constraint proveedores_nombre_check check (length(trim(nombre)) > 0)
);

create unique index if not exists proveedores_nombre_lower_unq
  on public.proveedores (lower(nombre));

comment on table public.proveedores is
  'Proveedores del circuito de compras. Alta desde la app; deja de ser un CHECK en código.';

alter table public.proveedores enable row level security;

drop policy if exists "proveedores_select_anon" on public.proveedores;
drop policy if exists "proveedores_insert_anon" on public.proveedores;
drop policy if exists "proveedores_update_anon" on public.proveedores;
drop policy if exists "proveedores_delete_anon" on public.proveedores;

create policy "proveedores_select_anon"
  on public.proveedores for select
  to anon
  using (true);

create policy "proveedores_insert_anon"
  on public.proveedores for insert
  to anon
  with check (true);

create policy "proveedores_update_anon"
  on public.proveedores for update
  to anon
  using (true)
  with check (true);

create policy "proveedores_delete_anon"
  on public.proveedores for delete
  to anon
  using (true);

insert into public.proveedores (nombre)
values
  ('Cominport'),
  ('Arrom'),
  ('Pescaderías Coruñesas'),
  ('García de Pou'),
  ('Nishikidori'),
  ('Isse Japan'),
  ('Amazon'),
  ('Frutas Eloy'),
  ('MAKRO'),
  ('BBQ FLAVOUR'),
  ('Vila Viniteca'),
  ('Vinalia'),
  ('Salvioni y Alomar')
on conflict ((lower(nombre))) do nothing;

insert into public.proveedores (nombre)
select distinct trim(proveedor)
from (
  select proveedor from public.pedidos_proveedores
  union
  select proveedor from public.stock_items
  union
  select proveedor from public.compras_historial
) s
where proveedor is not null and length(trim(proveedor)) > 0
on conflict ((lower(nombre))) do nothing;

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_check;

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_check;

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_check;

alter table public.pedidos_proveedores
  drop constraint if exists pedidos_proveedores_proveedor_fkey;

alter table public.pedidos_proveedores
  add constraint pedidos_proveedores_proveedor_fkey
  foreign key (proveedor) references public.proveedores (nombre)
  on update cascade;

alter table public.stock_items
  drop constraint if exists stock_items_proveedor_fkey;

alter table public.stock_items
  add constraint stock_items_proveedor_fkey
  foreign key (proveedor) references public.proveedores (nombre)
  on update cascade
  on delete set null;

alter table public.compras_historial
  drop constraint if exists compras_historial_proveedor_fkey;

alter table public.compras_historial
  add constraint compras_historial_proveedor_fkey
  foreign key (proveedor) references public.proveedores (nombre)
  on update cascade
  on delete set null;

insert into public.pedidos_proveedores (proveedor, items)
select p.nombre, '[]'::jsonb
from public.proveedores p
on conflict (proveedor) do nothing;
