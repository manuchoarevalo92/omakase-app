-- Horarios explícitos en el plan: cada preparación es un bloque en la grilla.
-- Ejecutar en Supabase si ya corriste produccion-plan.sql.

alter table public.produccion_plan
  add column if not exists hora_inicio text;

alter table public.produccion_plan
  add column if not exists hora_fin text;

-- Rellenar filas viejas (asignadas a bloque plantilla) con horario del bloque.
update public.produccion_plan p
set
  hora_inicio = b.hora_inicio,
  hora_fin = to_char(
    least(
      b.hora_fin::time,
      b.hora_inicio::time + make_interval(secs => p.duracion_estimada_segundos)
    ),
    'HH24:MI'
  )
from public.produccion_bloques b
where p.bloque_id = b.id
  and p.hora_inicio is null;

-- Fallback: 09:00 + duración estimada.
update public.produccion_plan
set
  hora_inicio = coalesce(hora_inicio, '09:00'),
  hora_fin = coalesce(
    hora_fin,
    to_char(
      '09:00'::time + make_interval(secs => duracion_estimada_segundos),
      'HH24:MI'
    )
  )
where hora_inicio is null or hora_fin is null;

create index if not exists produccion_plan_fecha_hora_idx
  on public.produccion_plan (fecha, hora_inicio);

comment on column public.produccion_plan.hora_inicio is
  'Hora de inicio del bloque de preparación en la grilla (HH:MM).';
comment on column public.produccion_plan.hora_fin is
  'Hora de fin del bloque de preparación en la grilla (HH:MM).';
