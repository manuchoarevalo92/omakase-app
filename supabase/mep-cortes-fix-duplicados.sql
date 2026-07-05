-- Arreglo puntual si la migración dejó duplicados (general, lomo) u otros pares repetidos.
-- Corré esto si ves: duplicate key "mep_cortes_categoria_nombre_unq".
-- Idempotente.

-- 1) Recuperar categoría desde pescado en filas legacy mal migradas.
update public.mep_cortes
set categoria = nullif(trim(pescado), '')
where pescado is not null
  and trim(pescado) <> ''
  and (
    categoria is null
    or trim(categoria) = ''
    or lower(trim(categoria)) = 'general'
  );

update public.mep_cortes
set categoria = 'General'
where categoria is null or trim(categoria) = '';

-- 2) Borrar duplicados (queda el registro más antiguo de cada par categoria+nombre).
delete from public.mep_cortes
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(trim(categoria)), lower(trim(nombre))
        order by created_at asc nulls last, id asc
      ) as rn
    from public.mep_cortes
  ) ranked
  where rn > 1
);

-- 3) pescado ya no es obligatorio.
alter table public.mep_cortes
  alter column pescado drop not null;

-- Verificación (debería devolver 0 filas):
-- select lower(categoria), lower(nombre), count(*)
-- from public.mep_cortes
-- group by 1, 2
-- having count(*) > 1;
