-- Eventos: menú propio + checklist de qué llevar.
-- Idempotente.

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  titulo text not null,
  lugar text,
  comensales smallint,
  estado text not null default 'borrador',
  notas text,
  creado_por_id text,
  creado_por_nombre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eventos
  drop constraint if exists eventos_estado_check;

alter table public.eventos
  add constraint eventos_estado_check
  check (estado in ('borrador', 'confirmado', 'completado', 'cancelado'));

create index if not exists eventos_fecha_idx on public.eventos (fecha desc);

create table if not exists public.evento_menu_items (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  plato_id uuid references public.platos(id) on delete set null,
  plato_nombre text not null,
  categoria text,
  seccion text,
  orden integer not null default 0,
  cantidad smallint not null default 1,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists evento_menu_items_evento_idx
  on public.evento_menu_items (evento_id, orden);

create table if not exists public.evento_checklist_items (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  titulo text not null,
  orden integer not null default 0,
  completado boolean not null default false,
  completado_at timestamptz,
  completado_por_id text,
  completado_por_nombre text,
  created_at timestamptz not null default now()
);

create index if not exists evento_checklist_items_evento_idx
  on public.evento_checklist_items (evento_id, orden);

comment on table public.eventos is
  'Eventos / catering: fecha, menú y checklist de qué llevar.';
comment on table public.evento_menu_items is
  'Ítems del menú del evento (plato del catálogo o texto libre).';
comment on table public.evento_checklist_items is
  'Checklist operativa por evento (qué llevar / preparar).';
