-- Fichas internas de personal: vacaciones y cobros (efectivo / transferencia / propinas).

create table if not exists public.personal_registros (
  id uuid primary key default gen_random_uuid(),
  persona_id text not null,
  tipo text not null,
  fecha date not null,
  fecha_hasta date,
  monto numeric(12, 2),
  notas text,
  creado_por_id text,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);

alter table public.personal_registros
  drop constraint if exists personal_registros_persona_id_check;

alter table public.personal_registros
  add constraint personal_registros_persona_id_check
  check (persona_id in ('manu', 'javi', 'santi', 'noelia'));

alter table public.personal_registros
  drop constraint if exists personal_registros_tipo_check;

alter table public.personal_registros
  add constraint personal_registros_tipo_check
  check (tipo in ('vacaciones', 'cobro_efectivo', 'cobro_transferencia', 'extra_propina'));

alter table public.personal_registros
  drop constraint if exists personal_registros_monto_check;

alter table public.personal_registros
  add constraint personal_registros_monto_check
  check (monto is null or monto >= 0);

alter table public.personal_registros
  drop constraint if exists personal_registros_fechas_check;

alter table public.personal_registros
  add constraint personal_registros_fechas_check
  check (fecha_hasta is null or fecha_hasta >= fecha);

create index if not exists personal_registros_persona_fecha_idx
  on public.personal_registros (persona_id, fecha desc);

create index if not exists personal_registros_tipo_fecha_idx
  on public.personal_registros (tipo, fecha desc);
