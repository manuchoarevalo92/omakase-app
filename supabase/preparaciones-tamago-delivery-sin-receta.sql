-- Tamago barra y Tamago delivery no comparten receta.
-- Se deja la receta de plato solo en barra; delivery queda sin receta hasta cargarla.
-- Idempotente.

update public.preparaciones
set receta_plato_id = null
where nombre = 'Tamago'
  and area = 'delivery';
