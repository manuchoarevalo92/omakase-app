/** Mensaje legible para errores de PostgREST / Supabase (RLS, permisos, etc.). */
export function formatPostgrestError(error: {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}): string {
  const bits: string[] = [error.message];
  if (error.details) {
    bits.push(String(error.details));
  }
  if (error.hint) {
    bits.push(`Sugerencia: ${error.hint}`);
  }
  const msg = error.message.toLowerCase();
  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("violates row-level security") ||
    msg.includes("permission denied") ||
    error.code === "42501"
  ) {
    if (msg.includes("recetas")) {
      bits.push(
        "RLS en la tabla recetas: la app usa la anon key. En Supabase → SQL Editor, creá políticas para el rol anon que permitan SELECT, INSERT y UPDATE (el guardado usa upsert). Ver supabase/recetas-rls-anon.sql en el repo."
      );
    } else if (msg.includes("historial_servicios")) {
      bits.push(
        "RLS en historial_servicios: hace falta INSERT y SELECT para anon si guardás menú y ves el historial."
      );
    } else {
      bits.push(
        "Error de permisos / RLS en Supabase: revisá las políticas de la tabla indicada en el mensaje para el rol anon (clave pública del cliente)."
      );
    }
  }
  if (
    msg.includes("could not find") &&
    msg.includes("column") &&
    msg.includes("schema cache")
  ) {
    bits.push(
      "La tabla en Supabase no tiene esa columna (o PostgREST no la ve todavía). Revisá el SQL Editor: suele resolverse con ALTER TABLE … ADD COLUMN o refrescando el esquema en API → Settings."
    );
    if (msg.includes("recetas") && msg.includes("pax")) {
      bits.push(
        'Ejemplo: alter table public.recetas add column if not exists pax integer; (archivo supabase/recetas-pax.sql en el repo).'
      );
    }
  }
  return bits.filter(Boolean).join(" ");
}
