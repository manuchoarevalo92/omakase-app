-- Cantidad por lote: duración escala según cuánto se hizo vs el lote de referencia.
-- Ejecutá si la tabla preparaciones ya existía sin estas columnas.

alter table public.preparaciones
  add column if not exists cantidad_referencia numeric(12, 3) not null default 1;

alter table public.preparaciones
  add column if not exists unidad_cantidad text not null default 'ud';

alter table public.preparaciones
  add column if not exists ultima_cantidad numeric(12, 3);

alter table public.preparaciones
  drop constraint if exists preparaciones_cantidad_referencia_check;

alter table public.preparaciones
  add constraint preparaciones_cantidad_referencia_check
  check (cantidad_referencia > 0);

alter table public.preparaciones
  drop constraint if exists preparaciones_ultima_cantidad_check;

alter table public.preparaciones
  add constraint preparaciones_ultima_cantidad_check
  check (ultima_cantidad is null or ultima_cantidad > 0);

alter table public.preparaciones
  drop constraint if exists preparaciones_unidad_cantidad_check;

alter table public.preparaciones
  add constraint preparaciones_unidad_cantidad_check
  check (unidad_cantidad in ('L', 'ml', 'kg', 'g', 'ud'));

comment on column public.preparaciones.cantidad_referencia is
  'Tamaño del lote para el que duracion_dias está calibrado (ej. 1 L → 7 días).';
comment on column public.preparaciones.unidad_cantidad is
  'Unidad de cantidad_referencia y ultima_cantidad: L, ml, kg, g, ud.';
comment on column public.preparaciones.ultima_cantidad is
  'Cantidad del último lote hecho; escala el recordatorio proporcionalmente.';
