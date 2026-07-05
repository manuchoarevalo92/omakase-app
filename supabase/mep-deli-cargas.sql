-- Registros de MEP delivery cargados por servicio (cantidades por corte).
-- Alimenta /mep-deli.

create table if not exists public.mep_deli_cargas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  servicio text,
  historial_servicio_id uuid references public.historial_servicios(id) on delete set null,
  lineas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mep_deli_cargas
  drop constraint if exists mep_deli_cargas_servicio_check;

alter table public.mep_deli_cargas
  add constraint mep_deli_cargas_servicio_check
  check (servicio is null or servicio in ('Mediodia', 'Noche'));

create index if not exists mep_deli_cargas_fecha_idx
  on public.mep_deli_cargas (fecha desc);

create index if not exists mep_deli_cargas_historial_idx
  on public.mep_deli_cargas (historial_servicio_id);

comment on table public.mep_deli_cargas is
  'MEP delivery guardada: fecha/servicio y cantidades por corte (JSON).';
comment on column public.mep_deli_cargas.lineas is
  'Array JSON: [{ "corte_id": "uuid", "cantidad": "120" }, ...].';
