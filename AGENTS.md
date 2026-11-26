<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commit y push automáticos

Cuando Manu pide un cambio (feature, fix, SQL, UI, etc.) y el trabajo queda listo:

1. **Commit** de los archivos relevantes (nunca `.env` ni secretos).
2. **Push** a `origin` de la rama actual (`git push -u origin HEAD` si hace falta).
3. No esperar a que diga "commit", "push" o "comiteá".

Excepciones: si Manu dice explícitamente que no suba / no commitee, o si hay un conflicto o riesgo claro (p. ej. un push con force a `main`) — ahí preguntar.

Protocolo de commit: revisar `git status`, `git diff` y `git log` antes; mensaje en HEREDOC siguiendo el estilo del historial (`feat(área): …` en español); no usar `--no-verify`; no hacer amend.

# Supabase: ejecución y RLS

## Quién corre el SQL

- **Nunca** pedirle a Manu que copie/pegue SQL en el SQL Editor.
- Si hay schema, migraciones o seeds: **correrlos yo** vía el MCP de Supabase (`apply_migration` / `execute_sql`) en el proyecto de Omakase (`qnddgsfecwezvjzexlwm`).
- Guardar también el `.sql` idempotente en `supabase/` para el repo.
- Si el MCP no está autenticado, avisarle a Manu para que lo autorice y reintentar antes de dar el paso por fallido.

## RLS obligatorio (privacidad)

- **Toda** tabla nueva o expuesta a la app debe tener `enable row level security` en la **misma** migración que la crea.
- Incluir policies para el rol que usa la app (`anon`) en el mismo paso — no dejar tablas con RLS off ni "después lo vemos".
- Patrón actual de la app (auth en cookie/sesión, cliente con anon key): policies `select/insert/update/delete` a `anon` explícitas; la restricción fina de roles (admin/staff) vive en la app.
- Nunca crear tablas públicas sin RLS. Si una tabla ya existe sin RLS, habilitarlo y agregar policies en cuanto se toque.

## Orden de trabajo

1. Escribir `supabase/{feature}.sql` + RLS (junto o en `*-rls-anon.sql`).
2. Aplicar en Supabase con el MCP.
3. Verificar tablas/policies si hace falta.
4. Seguir con el código de la app.
