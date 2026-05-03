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
    bits.push(
      "En Supabase: tabla historial_servicios → RLS. Suele hacer falta políticas que permitan INSERT y SELECT para el rol anon (clave pública del cliente)."
    );
  }
  return bits.filter(Boolean).join(" ");
}
