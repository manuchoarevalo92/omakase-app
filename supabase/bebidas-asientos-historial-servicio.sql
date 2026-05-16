-- Vincula bebidas por asiento al menú/servicio guardado en historial_servicios.
-- Ejecutá en SQL Editor si ya tenías bebidas_asientos solo por asiento (PK antigua).

-- Si preferís empezar limpio (sin migrar consumos huérfanos):
-- truncate table public.bebidas_asientos;

alter table public.bebidas_asientos
  add column if not exists historial_servicio_id uuid references public.historial_servicios(id) on delete cascade;

-- Opcional: asignar filas viejas al último menú guardado antes de hacer NOT NULL:
-- update public.bebidas_asientos b
-- set historial_servicio_id = (
--   select id from public.historial_servicios
--   order by fecha desc, hora desc nulls last, id desc
--   limit 1
-- )
-- where b.historial_servicio_id is null;

alter table public.bebidas_asientos drop constraint if exists bebidas_asientos_pkey;

delete from public.bebidas_asientos where historial_servicio_id is null;

alter table public.bebidas_asientos
  alter column historial_servicio_id set not null;

alter table public.bebidas_asientos
  add constraint bebidas_asientos_pkey primary key (historial_servicio_id, asiento);

create index if not exists bebidas_asientos_historial_idx
  on public.bebidas_asientos (historial_servicio_id);
