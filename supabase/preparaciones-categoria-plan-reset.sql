-- Deja todas las preparaciones pendientes de confirmar categoría en Tiempos prep.
-- Ejecutá esto si corriste preparaciones-categoria-plan-confirmada.sql y querés asignar manualmente.

update public.preparaciones
set categoria_plan_confirmada = false;
