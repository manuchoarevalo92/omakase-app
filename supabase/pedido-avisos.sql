-- Avisos manuales de "hace falta pedir X", cargados por cualquiera del equipo.
-- Alimenta la pantalla /avisos (recordatorios de pedido, al estilo /produccion
-- pero sin predicción: es 100% carga manual).
-- Idempotente: sirve si la tabla no existe o si ya existía una versión anterior.

create table if not exists public.pedido_avisos (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  nota text,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  resuelto_at timestamptz
);

alter table public.pedido_avisos
  drop constraint if exists pedido_avisos_estado_check;

alter table public.pedido_avisos
  add constraint pedido_avisos_estado_check
  check (estado in ('pendiente', 'resuelto'));

create index if not exists pedido_avisos_estado_idx
  on public.pedido_avisos (estado);

create index if not exists pedido_avisos_stock_item_idx
  on public.pedido_avisos (stock_item_id);

comment on table public.pedido_avisos is
  'Avisos manuales de "hace falta pedir X" cargados por el equipo en /avisos. Sin predicción: se agregan y se marcan como pedido a mano.';
comment on column public.pedido_avisos.nota is
  'Nota opcional (ej. "casi no queda", "para el finde", cantidad aproximada).';
comment on column public.pedido_avisos.estado is
  'pendiente: sigue en la lista activa. resuelto: ya se pidió, se marcó y desaparece de la lista.';
comment on column public.pedido_avisos.resuelto_at is
  'Cuándo se marcó como resuelto (pedido). Null mientras está pendiente.';
