-- Una sola MEP Deli por fecha (delivery nocturno). Ejecutar en SQL Editor.

-- Quedarse con la más reciente si hay duplicados del mismo día.
delete from public.mep_deli_cargas a
using public.mep_deli_cargas b
where a.fecha = b.fecha
  and a.id <> b.id
  and (coalesce(a.servicio, 'Noche') = 'Noche')
  and (coalesce(b.servicio, 'Noche') = 'Noche')
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id::text < b.id::text)
  );

drop index if exists public.mep_deli_cargas_fecha_noche_unq;

create unique index mep_deli_cargas_fecha_noche_unq
  on public.mep_deli_cargas (fecha)
  where servicio is null or servicio = 'Noche';
