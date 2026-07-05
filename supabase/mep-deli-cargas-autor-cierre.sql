-- Autor de la carga y cierre de servicio (OK / Faltó / Sobró) en MEP delivery.
-- Ejecutá si mep_deli_cargas ya existía sin estas columnas.

alter table public.mep_deli_cargas
  add column if not exists cargado_por_id text;

alter table public.mep_deli_cargas
  add column if not exists cargado_por_nombre text;

alter table public.mep_deli_cargas
  add column if not exists cierre_lineas jsonb;

alter table public.mep_deli_cargas
  add column if not exists cierre_at timestamptz;

alter table public.mep_deli_cargas
  add column if not exists cerrado_por_id text;

alter table public.mep_deli_cargas
  add column if not exists cerrado_por_nombre text;

comment on column public.mep_deli_cargas.cargado_por_id is
  'Id del usuario de la app que guardó la MEP (sesión).';
comment on column public.mep_deli_cargas.cargado_por_nombre is
  'Nombre visible de quien cargó la MEP.';
comment on column public.mep_deli_cargas.cierre_lineas is
  'Cierre del servicio: [{ "corte_id": "uuid", "resultado": "ok"|"falto"|"sobro", "cantidad": "2", "nota": "..." }].';
comment on column public.mep_deli_cargas.cierre_at is
  'Cuándo se registró el cierre de servicio.';
comment on column public.mep_deli_cargas.cerrado_por_id is
  'Id del usuario que cerró la MEP.';
comment on column public.mep_deli_cargas.cerrado_por_nombre is
  'Nombre visible de quien cerró la MEP.';
