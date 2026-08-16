import type { UserRole } from "@/src/lib/auth-users";
import type { Preparacion } from "@/src/lib/preparaciones";

export type RecetaViewer = {
  id: string;
  name: string;
  role: UserRole;
};

/** Quién puede ver receta/proceso de un bloque del plan. */
export function puedeVerRecetaDeBloque(opts: {
  viewer: RecetaViewer | null;
  prep: Preparacion | null;
  asignadoAId: string | null;
}): boolean {
  const { viewer, prep, asignadoAId } = opts;
  if (!viewer || !prep) {
    return false;
  }
  if (viewer.role === "admin") {
    return true;
  }
  if (prep.recetaSoloAdmin) {
    return false;
  }
  return Boolean(asignadoAId && asignadoAId === viewer.id);
}
