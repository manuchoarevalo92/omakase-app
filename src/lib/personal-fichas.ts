import { APP_USERS } from "@/src/lib/auth-users";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type PersonalFichaPersona = {
  id: string;
  name: string;
  /** Tiene usuario en la app (equipo fijo). */
  esStaff: boolean;
};

export const PERSONAL_TIPO_MOVIMIENTO = [
  "vacaciones",
  "cobro_efectivo",
  "cobro_transferencia",
  "extra_propina",
] as const;

export type PersonalTipoMovimiento = (typeof PERSONAL_TIPO_MOVIMIENTO)[number];

export type PersonalRegistro = {
  id: string;
  personaId: string;
  tipo: PersonalTipoMovimiento;
  fecha: string;
  fechaHasta: string | null;
  monto: number | null;
  notas: string | null;
  creadoPorId: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
};

type PersonalRegistroDb = {
  id: string;
  persona_id: string;
  tipo: string;
  fecha: string;
  fecha_hasta?: string | null;
  monto?: number | null;
  notas?: string | null;
  creado_por_id?: string | null;
  creado_por_nombre?: string | null;
  created_at: string;
};

export const PERSONAL_REGISTRO_SELECT =
  "id, persona_id, tipo, fecha, fecha_hasta, monto, notas, creado_por_id, creado_por_nombre, created_at";

/** Personas con ficha en /personal (staff + apoyo ocasional, sin login). */
export const PERSONAL_FICHAS: PersonalFichaPersona[] = [
  ...APP_USERS.map((u) => ({ id: u.id, name: u.displayName, esStaff: true })),
  { id: "noelia", name: "Noelia", esStaff: false },
];

export const PERSONAL_PERSONAS = PERSONAL_FICHAS;

export function nombrePersonalFicha(personaId: string): string {
  return PERSONAL_FICHAS.find((p) => p.id === personaId)?.name ?? personaId;
}

export const ETIQUETA_TIPO_MOVIMIENTO: Record<PersonalTipoMovimiento, string> = {
  vacaciones: "Vacaciones",
  cobro_efectivo: "Cobro efectivo",
  cobro_transferencia: "Cobro transferencia",
  extra_propina: "Extra propina",
};

function esTipoValido(v: string | null | undefined): v is PersonalTipoMovimiento {
  if (!v) return false;
  return (PERSONAL_TIPO_MOVIMIENTO as readonly string[]).includes(v);
}

function parseRegistro(row: PersonalRegistroDb): PersonalRegistro {
  return {
    id: row.id,
    personaId: row.persona_id,
    tipo: esTipoValido(row.tipo) ? row.tipo : "extra_propina",
    fecha: row.fecha,
    fechaHasta: row.fecha_hasta ?? null,
    monto: row.monto != null && Number.isFinite(row.monto) ? row.monto : null,
    notas: row.notas?.trim() || null,
    creadoPorId: row.creado_por_id ?? null,
    creadoPorNombre: row.creado_por_nombre ?? null,
    createdAt: row.created_at,
  };
}

export async function fetchPersonalRegistros(): Promise<PersonalRegistro[]> {
  const { data, error } = await supabase
    .from("personal_registros")
    .select(PERSONAL_REGISTRO_SELECT)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(formatPostgrestError(error));
  return ((data ?? []) as PersonalRegistroDb[]).map(parseRegistro);
}

export async function crearPersonalRegistro(input: {
  personaId: string;
  tipo: PersonalTipoMovimiento;
  fecha: string;
  fechaHasta?: string | null;
  monto?: number | null;
  notas?: string | null;
  creadoPorId?: string | null;
  creadoPorNombre?: string | null;
}): Promise<PersonalRegistro> {
  const { data, error } = await supabase
    .from("personal_registros")
    .insert({
      persona_id: input.personaId,
      tipo: input.tipo,
      fecha: input.fecha,
      fecha_hasta: input.fechaHasta ?? null,
      monto: input.monto ?? null,
      notas: input.notas?.trim() || null,
      creado_por_id: input.creadoPorId ?? null,
      creado_por_nombre: input.creadoPorNombre ?? null,
    })
    .select(PERSONAL_REGISTRO_SELECT)
    .single();
  if (error) throw new Error(formatPostgrestError(error));
  return parseRegistro(data as PersonalRegistroDb);
}

export async function eliminarPersonalRegistro(id: string): Promise<void> {
  const { error } = await supabase.from("personal_registros").delete().eq("id", id);
  if (error) throw new Error(formatPostgrestError(error));
}
