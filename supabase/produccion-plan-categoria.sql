-- DEPRECADO: usar preparaciones-categoria-plan.sql + produccion-plan-categorias-v2.sql
-- Si solo tenías produ/servicio, ejecutá esos dos scripts en orden.

alter table public.produccion_plan
  add column if not exists categoria text not null default 'prep_barra';
