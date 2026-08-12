-- Papel verde en nigiri + papel verde / placa de inox en checklists.
-- Idempotente.

insert into public.plato_necesidades (plato_id, item, orden)
select p.id, 'Papel verde', coalesce(
  (select max(pn.orden) + 10 from public.plato_necesidades pn where pn.plato_id = p.id),
  10
)
from public.platos p
where p.categoria = 'Nigiri'
  and not exists (
    select 1 from public.plato_necesidades pn
    where pn.plato_id = p.id and lower(trim(pn.item)) = 'papel verde'
  );

with nuevos(titulo, categoria, unidad, cantidad) as (
  values
    ('Papel verde', 'seco', 'unidad', 1),
    ('Placa de inox', 'equipo', 'unidad', 1)
),
max_orden as (
  select evento_id, coalesce(max(orden), 0) as max_o
  from public.evento_checklist_items
  group by evento_id
),
a_insertar as (
  select
    e.id as evento_id,
    n.titulo,
    n.categoria,
    n.unidad,
    n.cantidad,
    m.max_o + (row_number() over (partition by e.id order by n.titulo)) * 10 as orden
  from public.eventos e
  cross join nuevos n
  left join max_orden m on m.evento_id = e.id
  where not exists (
    select 1
    from public.evento_checklist_items c
    where c.evento_id = e.id
      and lower(trim(c.titulo)) = lower(trim(n.titulo))
  )
)
insert into public.evento_checklist_items
  (evento_id, titulo, categoria, unidad, cantidad, orden, completado)
select evento_id, titulo, categoria, unidad, cantidad, orden, false
from a_insertar;
