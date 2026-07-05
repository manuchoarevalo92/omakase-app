-- Nota de relevo opcional al guardar la MEP (mensaje para el compañero de turno).

alter table public.mep_deli_cargas
  add column if not exists nota_relevo text;

comment on column public.mep_deli_cargas.nota_relevo is
  'Nota libre para el relevo (ej. dónde quedó algo, aviso para el cierre).';
