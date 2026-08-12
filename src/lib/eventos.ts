import { fetchSessionUsuario } from "@/src/lib/produccion-sesiones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export const EVENTO_ESTADOS = [
  "borrador",
  "confirmado",
  "completado",
  "cancelado",
] as const;

export type EventoEstado = (typeof EVENTO_ESTADOS)[number];

export type Evento = {
  id: string;
  fecha: string;
  hora: string | null;
  titulo: string;
  lugar: string | null;
  comensales: number | null;
  estado: EventoEstado;
  notas: string | null;
  creadoPorId: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventoMenuItem = {
  id: string;
  eventoId: string;
  platoId: string | null;
  platoNombre: string;
  categoria: string | null;
  orden: number;
  cantidad: number;
  notas: string | null;
  createdAt: string;
};

export type EventoChecklistItem = {
  id: string;
  eventoId: string;
  titulo: string;
  orden: number;
  completado: boolean;
  completadoAt: string | null;
  completadoPorId: string | null;
  completadoPorNombre: string | null;
  createdAt: string;
};

export type EventoDetalle = Evento & {
  menuItems: EventoMenuItem[];
  checklistItems: EventoChecklistItem[];
};

type EventoDb = {
  id: string;
  fecha: string;
  hora?: string | null;
  titulo: string;
  lugar?: string | null;
  comensales?: number | null;
  estado: string;
  notas?: string | null;
  creado_por_id?: string | null;
  creado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
};

type EventoMenuItemDb = {
  id: string;
  evento_id: string;
  plato_id?: string | null;
  plato_nombre: string;
  categoria?: string | null;
  orden: number;
  cantidad: number;
  notas?: string | null;
  created_at: string;
};

type EventoChecklistItemDb = {
  id: string;
  evento_id: string;
  titulo: string;
  orden: number;
  completado: boolean;
  completado_at?: string | null;
  completado_por_id?: string | null;
  completado_por_nombre?: string | null;
  created_at: string;
};

export const EVENTO_SELECT =
  "id, fecha, hora, titulo, lugar, comensales, estado, notas, creado_por_id, creado_por_nombre, created_at, updated_at";

export const EVENTO_MENU_SELECT =
  "id, evento_id, plato_id, plato_nombre, categoria, orden, cantidad, notas, created_at";

export const EVENTO_CHECKLIST_SELECT =
  "id, evento_id, titulo, orden, completado, completado_at, completado_por_id, completado_por_nombre, created_at";

export const ETIQUETA_EVENTO_ESTADO: Record<EventoEstado, string> = {
  borrador: "Borrador",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

/** Plantilla inicial al crear un evento. */
export const CHECKLIST_PLANTILLA_EVENTO = [
  "Confirmar menú con cliente",
  "Revisar ingredientes y compras",
  "MEP / mise en place del evento",
  "Bebidas preparadas",
  "Cajas térmicas / transporte",
  "Utensilios y tablas",
  "Servilletas / descartables",
  "Menú impreso o carteles",
] as const;

function esEstadoValido(v: string | null | undefined): v is EventoEstado {
  if (!v) return false;
  return (EVENTO_ESTADOS as readonly string[]).includes(v);
}

function parseEvento(row: EventoDb): Evento {
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora?.trim() || null,
    titulo: row.titulo,
    lugar: row.lugar?.trim() || null,
    comensales:
      row.comensales != null && Number.isFinite(row.comensales) ? row.comensales : null,
    estado: esEstadoValido(row.estado) ? row.estado : "borrador",
    notas: row.notas?.trim() || null,
    creadoPorId: row.creado_por_id ?? null,
    creadoPorNombre: row.creado_por_nombre ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseMenuItem(row: EventoMenuItemDb): EventoMenuItem {
  return {
    id: row.id,
    eventoId: row.evento_id,
    platoId: row.plato_id ?? null,
    platoNombre: row.plato_nombre,
    categoria: row.categoria?.trim() || null,
    orden: row.orden,
    cantidad: row.cantidad > 0 ? row.cantidad : 1,
    notas: row.notas?.trim() || null,
    createdAt: row.created_at,
  };
}

function parseChecklistItem(row: EventoChecklistItemDb): EventoChecklistItem {
  return {
    id: row.id,
    eventoId: row.evento_id,
    titulo: row.titulo,
    orden: row.orden,
    completado: row.completado === true,
    completadoAt: row.completado_at ?? null,
    completadoPorId: row.completado_por_id ?? null,
    completadoPorNombre: row.completado_por_nombre ?? null,
    createdAt: row.created_at,
  };
}

export function etiquetaEvento(evento: Pick<Evento, "fecha" | "hora" | "titulo">): string {
  const hora = evento.hora?.trim();
  return hora ? `${evento.fecha} ${hora} · ${evento.titulo}` : `${evento.fecha} · ${evento.titulo}`;
}

export function progresoChecklist(items: EventoChecklistItem[]): {
  total: number;
  listos: number;
} {
  const total = items.length;
  const listos = items.filter((i) => i.completado).length;
  return { total, listos };
}

export async function fetchEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select(EVENTO_SELECT)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(formatPostgrestError(error));
  return ((data ?? []) as EventoDb[]).map(parseEvento);
}

export async function fetchEventoDetalle(id: string): Promise<EventoDetalle | null> {
  const { data: eventoRow, error: eventoError } = await supabase
    .from("eventos")
    .select(EVENTO_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (eventoError) throw new Error(formatPostgrestError(eventoError));
  if (!eventoRow) return null;

  const [menuRes, checklistRes] = await Promise.all([
    supabase
      .from("evento_menu_items")
      .select(EVENTO_MENU_SELECT)
      .eq("evento_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("evento_checklist_items")
      .select(EVENTO_CHECKLIST_SELECT)
      .eq("evento_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (menuRes.error) throw new Error(formatPostgrestError(menuRes.error));
  if (checklistRes.error) throw new Error(formatPostgrestError(checklistRes.error));

  return {
    ...parseEvento(eventoRow as EventoDb),
    menuItems: ((menuRes.data ?? []) as EventoMenuItemDb[]).map(parseMenuItem),
    checklistItems: ((checklistRes.data ?? []) as EventoChecklistItemDb[]).map(
      parseChecklistItem
    ),
  };
}

export async function crearEvento(input: {
  titulo: string;
  fecha: string;
  hora?: string | null;
  lugar?: string | null;
  comensales?: number | null;
  notas?: string | null;
  creadoPorId?: string | null;
  creadoPorNombre?: string | null;
}): Promise<EventoDetalle> {
  const titulo = input.titulo.trim();
  if (!titulo) {
    throw new Error("El título del evento es obligatorio.");
  }

  const usuario =
    input.creadoPorId && input.creadoPorNombre
      ? { id: input.creadoPorId, name: input.creadoPorNombre }
      : await fetchSessionUsuario();

  const { data: eventoRow, error: eventoError } = await supabase
    .from("eventos")
    .insert({
      titulo,
      fecha: input.fecha,
      hora: input.hora?.trim() || null,
      lugar: input.lugar?.trim() || null,
      comensales: input.comensales ?? null,
      notas: input.notas?.trim() || null,
      creado_por_id: usuario?.id ?? null,
      creado_por_nombre: usuario?.name ?? null,
    })
    .select(EVENTO_SELECT)
    .single();

  if (eventoError) throw new Error(formatPostgrestError(eventoError));

  const evento = parseEvento(eventoRow as EventoDb);

  const checklistPayload = CHECKLIST_PLANTILLA_EVENTO.map((tituloItem, index) => ({
    evento_id: evento.id,
    titulo: tituloItem,
    orden: (index + 1) * 10,
  }));

  const { data: checklistRows, error: checklistError } = await supabase
    .from("evento_checklist_items")
    .insert(checklistPayload)
    .select(EVENTO_CHECKLIST_SELECT);

  if (checklistError) throw new Error(formatPostgrestError(checklistError));

  return {
    ...evento,
    menuItems: [],
    checklistItems: ((checklistRows ?? []) as EventoChecklistItemDb[]).map(parseChecklistItem),
  };
}

export async function actualizarEvento(
  id: string,
  input: Partial<{
    titulo: string;
    fecha: string;
    hora: string | null;
    lugar: string | null;
    comensales: number | null;
    estado: EventoEstado;
    notas: string | null;
  }>
): Promise<Evento> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.titulo !== undefined) payload.titulo = input.titulo.trim();
  if (input.fecha !== undefined) payload.fecha = input.fecha;
  if (input.hora !== undefined) payload.hora = input.hora?.trim() || null;
  if (input.lugar !== undefined) payload.lugar = input.lugar?.trim() || null;
  if (input.comensales !== undefined) payload.comensales = input.comensales;
  if (input.estado !== undefined) payload.estado = input.estado;
  if (input.notas !== undefined) payload.notas = input.notas?.trim() || null;

  const { data, error } = await supabase
    .from("eventos")
    .update(payload)
    .eq("id", id)
    .select(EVENTO_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseEvento(data as EventoDb);
}

export async function eliminarEvento(id: string): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw new Error(formatPostgrestError(error));
}

export async function crearEventoMenuItem(input: {
  eventoId: string;
  platoId?: string | null;
  platoNombre: string;
  categoria?: string | null;
  cantidad?: number;
  notas?: string | null;
  orden?: number;
}): Promise<EventoMenuItem> {
  const platoNombre = input.platoNombre.trim();
  if (!platoNombre) {
    throw new Error("El nombre del ítem de menú es obligatorio.");
  }

  let orden = input.orden;
  if (orden == null) {
    const { data: existentes } = await supabase
      .from("evento_menu_items")
      .select("orden")
      .eq("evento_id", input.eventoId)
      .order("orden", { ascending: false })
      .limit(1);
    const maxOrden = (existentes?.[0] as { orden?: number } | undefined)?.orden ?? 0;
    orden = maxOrden + 10;
  }

  const { data, error } = await supabase
    .from("evento_menu_items")
    .insert({
      evento_id: input.eventoId,
      plato_id: input.platoId ?? null,
      plato_nombre: platoNombre,
      categoria: input.categoria?.trim() || null,
      cantidad: input.cantidad && input.cantidad > 0 ? input.cantidad : 1,
      notas: input.notas?.trim() || null,
      orden,
    })
    .select(EVENTO_MENU_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseMenuItem(data as EventoMenuItemDb);
}

export async function eliminarEventoMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("evento_menu_items").delete().eq("id", id);
  if (error) throw new Error(formatPostgrestError(error));
}

export async function crearEventoChecklistItem(input: {
  eventoId: string;
  titulo: string;
  orden?: number;
}): Promise<EventoChecklistItem> {
  const titulo = input.titulo.trim();
  if (!titulo) {
    throw new Error("El ítem de checklist es obligatorio.");
  }

  let orden = input.orden;
  if (orden == null) {
    const { data: existentes } = await supabase
      .from("evento_checklist_items")
      .select("orden")
      .eq("evento_id", input.eventoId)
      .order("orden", { ascending: false })
      .limit(1);
    const maxOrden = (existentes?.[0] as { orden?: number } | undefined)?.orden ?? 0;
    orden = maxOrden + 10;
  }

  const { data, error } = await supabase
    .from("evento_checklist_items")
    .insert({
      evento_id: input.eventoId,
      titulo,
      orden,
    })
    .select(EVENTO_CHECKLIST_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseChecklistItem(data as EventoChecklistItemDb);
}

export async function toggleEventoChecklistItem(
  item: EventoChecklistItem,
  completado: boolean
): Promise<EventoChecklistItem> {
  const usuario = await fetchSessionUsuario();
  const ahora = new Date().toISOString();

  const { data, error } = await supabase
    .from("evento_checklist_items")
    .update({
      completado,
      completado_at: completado ? ahora : null,
      completado_por_id: completado ? usuario?.id ?? null : null,
      completado_por_nombre: completado ? usuario?.name ?? null : null,
    })
    .eq("id", item.id)
    .select(EVENTO_CHECKLIST_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseChecklistItem(data as EventoChecklistItemDb);
}

export async function eliminarEventoChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from("evento_checklist_items").delete().eq("id", id);
  if (error) throw new Error(formatPostgrestError(error));
}
