-- Rubro de almacén para agrupar en la pantalla Ingredientes.
-- Ejecutá en Supabase → SQL Editor si la app pide la columna `rubro`.

alter table public.ingredientes
  add column if not exists rubro text;

update public.ingredientes
set rubro = 'Despensa'
where rubro is null or trim(rubro) = '';

comment on column public.ingredientes.rubro is 'Pescado/Marisco | Fruta/Vegetal | Despensa';
