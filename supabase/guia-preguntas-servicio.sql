-- Guía de bebidas: preguntas de repaso del protocolo de servicio (sección Servicio).
-- Idempotente: `pregunta` es única. La tabla ya tiene RLS y policies (guia-bebidas.sql).

insert into public.guia_preguntas (area, pregunta, orden) values
  ('Protocolo de servicio', '¿Por dónde se agarra una copa y por qué?', 43),
  ('Protocolo de servicio', 'Te piden una botella de vino: ¿en qué orden van mostrar, abrir, dar a probar y servir?', 44),
  ('Protocolo de servicio', '¿A quién le das a probar la botella, cuánto le servís y qué está chequeando?', 45),
  ('Protocolo de servicio', 'El comensal dice que el vino tiene un defecto. ¿Qué hacés?', 46),
  ('Protocolo de servicio', '¿Hasta dónde se llena una copa de vino? ¿A quién le servís último?', 47),
  ('Protocolo de servicio', '¿Cómo se abre un espumoso sin que haga «pop»?', 48),
  ('Protocolo de servicio', '¿Cómo se sirve desde un tokkuri y hasta dónde llenás el ochoko?', 49),
  ('Protocolo de servicio', '¿Por qué en Japón nadie se sirve su propio sake? ¿Qué hacés si ves un ochoko vacío?', 50),
  ('Protocolo de servicio', 'Te preguntan algo de una bebida que no sabés. ¿Qué decís?', 51),
  ('Protocolo de servicio', 'Acabás de servir una copa de Kido. ¿Qué anotás en Bebidas?', 52)
on conflict (pregunta) do nothing;
