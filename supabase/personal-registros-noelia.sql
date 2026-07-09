-- Si ya corriste personal-registros.sql sin Noelia, ejecutá esto en Supabase.

alter table public.personal_registros
  drop constraint if exists personal_registros_persona_id_check;

alter table public.personal_registros
  add constraint personal_registros_persona_id_check
  check (persona_id in ('manu', 'javi', 'santi', 'noelia'));
