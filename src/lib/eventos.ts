import {
  MENU_GUARDADO_NIGIRI,
  MENU_GUARDADO_OTSUMAMI,
  MENU_GUARDADO_POSTRE,
} from "@/src/lib/menu-omakase-guardado";
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

export const EVENTO_MENU_SECCIONES = [
  "otsumami",
  "regalo",
  "nigiri",
  "postre",
  "extra",
] as const;

export type EventoMenuSeccion = (typeof EVENTO_MENU_SECCIONES)[number];

/** Misma estructura que el menú diario: 4+12+1 = 17 base, +2 regalos opcionales. */
export const EVENTO_OTSUMAMI_BASE = MENU_GUARDADO_OTSUMAMI;
export const EVENTO_OTSUMAMI_REGALO = 2;
export const EVENTO_NIGIRI_BASE = MENU_GUARDADO_NIGIRI;
export const EVENTO_POSTRE_BASE = MENU_GUARDADO_POSTRE;
export const EVENTO_TOTAL_BASE =
  EVENTO_OTSUMAMI_BASE + EVENTO_NIGIRI_BASE + EVENTO_POSTRE_BASE;

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
  seccion: EventoMenuSeccion | null;
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
  cantidad: number;
  unidad: string;
  categoria: EventoChecklistCategoria;
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

export type EventoMenuOmakaseSlots = {
  otsumami: string[];
  regalo: string[];
  nigiri: string[];
  postre: string[];
  nigiriOnly: boolean;
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
  seccion?: string | null;
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
  cantidad?: number | null;
  unidad?: string | null;
  categoria?: string | null;
  completado: boolean;
  completado_at?: string | null;
  completado_por_id?: string | null;
  completado_por_nombre?: string | null;
  created_at: string;
};

export const EVENTO_SELECT =
  "id, fecha, hora, titulo, lugar, comensales, estado, notas, creado_por_id, creado_por_nombre, created_at, updated_at";

export const EVENTO_MENU_SELECT =
  "id, evento_id, plato_id, plato_nombre, categoria, seccion, orden, cantidad, notas, created_at";

export const EVENTO_MENU_SELECT_BASE =
  "id, evento_id, plato_id, plato_nombre, categoria, orden, cantidad, notas, created_at";

export const EVENTO_CHECKLIST_SELECT =
  "id, evento_id, titulo, orden, cantidad, unidad, categoria, completado, completado_at, completado_por_id, completado_por_nombre, created_at";

export const EVENTO_CHECKLIST_SELECT_BASE =
  "id, evento_id, titulo, orden, cantidad, unidad, completado, completado_at, completado_por_id, completado_por_nombre, created_at";

/** Unidades sugeridas en checklist (texto libre también permitido). */
export const EVENTO_CHECKLIST_UNIDADES = [
  "unidad",
  "caja",
  "saco",
  "porción",
  "kg",
  "g",
  "L",
  "pack",
] as const;

/** Categorías de packing para revisar la checklist por bloques. */
export const EVENTO_CHECKLIST_CATEGORIAS = [
  "fresco",
  "seco",
  "preparados",
  "vajilla",
  "utensilios",
  "equipo",
  "bebidas",
  "logistica",
  "otros",
] as const;

export type EventoChecklistCategoria = (typeof EVENTO_CHECKLIST_CATEGORIAS)[number];

export const ETIQUETA_CHECKLIST_CATEGORIA: Record<EventoChecklistCategoria, string> = {
  fresco: "Fresco",
  seco: "Seco",
  preparados: "Preparados",
  vajilla: "Vajilla",
  utensilios: "Utensilios",
  equipo: "Equipo",
  bebidas: "Bebidas",
  logistica: "Logística",
  otros: "Otros",
};

const CHECKLIST_CAT_SET = new Set<string>(EVENTO_CHECKLIST_CATEGORIAS);

function esCategoriaChecklist(v: string | null | undefined): v is EventoChecklistCategoria {
  return Boolean(v && CHECKLIST_CAT_SET.has(v));
}

/** Clasifica un título de checklist (heurística; se puede corregir a mano). */
export function inferirCategoriaChecklist(titulo: string): EventoChecklistCategoria {
  const t = titulo.trim().toLowerCase();
  if (!t) return "otros";

  if (
    /bebida|sake|vino|cerveza|agua|chagu[aá]n|refresco|\bt[eé]\b/.test(t)
  ) {
    return "bebidas";
  }

  if (
    /confirmar men[uú]|revisar ingredientes|mise en place|\bmep\b|impreso|cartel|servilleta|descartable|compra/.test(
      t
    )
  ) {
    return "logistica";
  }

  if (
    /ohitsu|neta box|contenedor de arroz/.test(t)
  ) {
    return "equipo";
  }

  if (
    /vajilla|platito|plato|bol|bowl|palitos(?! de)|apoyapalitos|cucharita|apoyacucharita|oshibori|apoya oshibori|tenedor/.test(
      t
    )
  ) {
    return "vajilla";
  }

  if (
    /utensilio|tabla|pinza|pincel|rallador|suribachi|saru|colador|brochet|brochette|cuchillo/.test(
      t
    )
  ) {
    return "utensilios";
  }

  if (
    /caja t[eé]rmica|transporte|arrocera|parrill|carb[oó]n|placa para cocinar|recipiente para zuke|contenedor/.test(
      t
    ) ||
    t === "carbón" ||
    t === "carbon"
  ) {
    return "equipo";
  }

  if (
    /salsa|nikiri|nitsume|tosazu|\bsu\b|karashi|warabi|pasta negitoro|leche de soja|crema\b|preparado/.test(
      t
    )
  ) {
    return "preparados";
  }

  if (
    /arroz|nori|kombu|alga|s[eé]samo|kuzu|polvo de coco|sal\b|az[uú]car/.test(t)
  ) {
    return "seco";
  }

  if (
    /akami|anguila|calamar|chipir|chutoro|dorada|erizo|hamachi|ikura|kama|quisquilla|salm[oó]n|shima|vieira|wasabi|jengibre|shiso|myoga|cebolleta|cebollino|ciboulette|yuzu|junsai|hueva|flores|fresco/.test(
      t
    )
  ) {
    return "fresco";
  }

  return "otros";
}

export function agruparChecklistPorCategoria(
  items: EventoChecklistItem[]
): { categoria: EventoChecklistCategoria; etiqueta: string; items: EventoChecklistItem[] }[] {
  const map = new Map<EventoChecklistCategoria, EventoChecklistItem[]>();
  for (const cat of EVENTO_CHECKLIST_CATEGORIAS) {
    map.set(cat, []);
  }
  for (const item of items) {
    const cat = esCategoriaChecklist(item.categoria) ? item.categoria : "otros";
    map.get(cat)!.push(item);
  }
  return EVENTO_CHECKLIST_CATEGORIAS.map((categoria) => ({
    categoria,
    etiqueta: ETIQUETA_CHECKLIST_CATEGORIA[categoria],
    items: map.get(categoria) ?? [],
  })).filter((bloque) => bloque.items.length > 0);
}

export const ETIQUETA_EVENTO_ESTADO: Record<EventoEstado, string> = {
  borrador: "Borrador",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETA_EVENTO_SECCION: Record<EventoMenuSeccion, string> = {
  otsumami: "Otsumami",
  regalo: "Otsumami regalo",
  nigiri: "Nigiri",
  postre: "Postre",
  extra: "Extra",
};

/** Plantilla inicial al crear un evento (logística). La checklist por plato viene después. */
export const CHECKLIST_PLANTILLA_EVENTO: {
  titulo: string;
  categoria: EventoChecklistCategoria;
}[] = [
  { titulo: "Confirmar menú con cliente", categoria: "logistica" },
  { titulo: "Revisar ingredientes y compras", categoria: "logistica" },
  { titulo: "MEP / mise en place del evento", categoria: "logistica" },
  { titulo: "Bebidas preparadas", categoria: "bebidas" },
  { titulo: "Cajas térmicas / transporte", categoria: "equipo" },
  { titulo: "Utensilios y tablas", categoria: "utensilios" },
  { titulo: "Servilletas / descartables", categoria: "logistica" },
  { titulo: "Menú impreso o carteles", categoria: "logistica" },
  { titulo: "Oshibori", categoria: "vajilla" },
  { titulo: "Apoya oshibori", categoria: "vajilla" },
  { titulo: "Tenedores de postre", categoria: "vajilla" },
];

function esEstadoValido(v: string | null | undefined): v is EventoEstado {
  if (!v) return false;
  return (EVENTO_ESTADOS as readonly string[]).includes(v);
}

function esSeccionValida(v: string | null | undefined): v is EventoMenuSeccion {
  if (!v) return false;
  return (EVENTO_MENU_SECCIONES as readonly string[]).includes(v);
}

function seccionDesdeLegacy(categoria: string | null | undefined): EventoMenuSeccion | null {
  const cat = categoria?.trim().toLowerCase() ?? "";
  if (cat === "otsumami") return "otsumami";
  if (cat === "nigiri") return "nigiri";
  if (cat === "postre") return "postre";
  if (cat) return "extra";
  return null;
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
  const seccionRaw = row.seccion?.trim() || null;
  return {
    id: row.id,
    eventoId: row.evento_id,
    platoId: row.plato_id ?? null,
    platoNombre: row.plato_nombre,
    categoria: row.categoria?.trim() || null,
    seccion: esSeccionValida(seccionRaw)
      ? seccionRaw
      : seccionDesdeLegacy(row.categoria),
    orden: row.orden,
    cantidad: row.cantidad > 0 ? row.cantidad : 1,
    notas: row.notas?.trim() || null,
    createdAt: row.created_at,
  };
}

function parseChecklistItem(row: EventoChecklistItemDb): EventoChecklistItem {
  const cantidad =
    row.cantidad != null && Number.isFinite(row.cantidad) && row.cantidad > 0
      ? Math.floor(row.cantidad)
      : 1;
  const unidad = row.unidad?.trim() || "unidad";
  const categoriaRaw = row.categoria?.trim() || "";
  const categoria = esCategoriaChecklist(categoriaRaw)
    ? categoriaRaw
    : inferirCategoriaChecklist(row.titulo);
  return {
    id: row.id,
    eventoId: row.evento_id,
    titulo: row.titulo,
    orden: row.orden,
    cantidad,
    unidad,
    categoria,
    completado: row.completado === true,
    completadoAt: row.completado_at ?? null,
    completadoPorId: row.completado_por_id ?? null,
    completadoPorNombre: row.completado_por_nombre ?? null,
    createdAt: row.created_at,
  };
}

/** Rellena categoría cuando aún no está asignada o quedó en "otros". */
async function backfillCategoriasChecklist(
  rows: EventoChecklistItemDb[]
): Promise<EventoChecklistItem[]> {
  const pendientes = rows.filter((row) => {
    const raw = row.categoria?.trim() || "";
    if (!esCategoriaChecklist(raw)) return true;
    if (raw !== "otros") return false;
    return inferirCategoriaChecklist(row.titulo) !== "otros";
  });

  if (pendientes.length === 0) {
    return rows.map(parseChecklistItem);
  }

  const actualizados = await Promise.all(
    pendientes.map(async (row) => {
      const categoria = inferirCategoriaChecklist(row.titulo);
      const { data, error } = await supabase
        .from("evento_checklist_items")
        .update({ categoria })
        .eq("id", row.id)
        .select(EVENTO_CHECKLIST_SELECT)
        .single();
      if (error || !data) {
        return parseChecklistItem({ ...row, categoria });
      }
      return parseChecklistItem(data as EventoChecklistItemDb);
    })
  );

  const porId = new Map(actualizados.map((i) => [i.id, i]));
  return rows.map((row) => porId.get(row.id) ?? parseChecklistItem(row));
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

function slotsVacios(): EventoMenuOmakaseSlots {
  return {
    otsumami: Array.from({ length: EVENTO_OTSUMAMI_BASE }, () => ""),
    regalo: Array.from({ length: EVENTO_OTSUMAMI_REGALO }, () => ""),
    nigiri: Array.from({ length: EVENTO_NIGIRI_BASE }, () => ""),
    postre: Array.from({ length: EVENTO_POSTRE_BASE }, () => ""),
    nigiriOnly: false,
  };
}

function rellenarSlots(ids: string[], largo: number): string[] {
  const out = Array.from({ length: largo }, () => "");
  ids
    .filter((id) => id.trim())
    .slice(0, largo)
    .forEach((id, i) => {
      out[i] = id;
    });
  return out;
}

/** Hidrata los selects del menú Omakase desde ítems guardados. */
export function slotsDesdeMenuItems(items: EventoMenuItem[]): EventoMenuOmakaseSlots {
  const porSeccion = (seccion: EventoMenuSeccion) =>
    items
      .filter((i) => i.seccion === seccion && i.platoId)
      .sort((a, b) => a.orden - b.orden)
      .map((i) => i.platoId as string);

  const otsumami = porSeccion("otsumami");
  const regalo = porSeccion("regalo");
  const nigiri = porSeccion("nigiri");
  const postre = porSeccion("postre");

  const tieneOtsumamiOPostre =
    otsumami.length > 0 || postre.length > 0 || regalo.length > 0;
  const nigiriOnly = nigiri.length > 0 && !tieneOtsumamiOPostre;

  return {
    otsumami: rellenarSlots(otsumami, EVENTO_OTSUMAMI_BASE),
    regalo: rellenarSlots(regalo, EVENTO_OTSUMAMI_REGALO),
    nigiri: rellenarSlots(nigiri, EVENTO_NIGIRI_BASE),
    postre: rellenarSlots(postre, EVENTO_POSTRE_BASE),
    nigiriOnly,
  };
}

export function extrasDesdeMenuItems(items: EventoMenuItem[]): EventoMenuItem[] {
  return items
    .filter((i) => i.seccion === "extra")
    .sort((a, b) => a.orden - b.orden);
}

export function contarPasosMenu(slots: EventoMenuOmakaseSlots): {
  base: number;
  baseObjetivo: number;
  regalo: number;
} {
  if (slots.nigiriOnly) {
    return {
      base: slots.nigiri.filter((id) => id.trim()).length,
      baseObjetivo: EVENTO_NIGIRI_BASE,
      regalo: 0,
    };
  }
  const base =
    slots.otsumami.filter((id) => id.trim()).length +
    slots.nigiri.filter((id) => id.trim()).length +
    slots.postre.filter((id) => id.trim()).length;
  return {
    base,
    baseObjetivo: EVENTO_TOTAL_BASE,
    regalo: slots.regalo.filter((id) => id.trim()).length,
  };
}

async function fetchMenuItems(eventoId: string): Promise<EventoMenuItem[]> {
  const selects = [EVENTO_MENU_SELECT, EVENTO_MENU_SELECT_BASE] as const;
  let lastError: { message: string } | null = null;
  for (const select of selects) {
    const { data, error } = await supabase
      .from("evento_menu_items")
      .select(select as string)
      .eq("evento_id", eventoId)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error) {
      return ((data ?? []) as unknown as EventoMenuItemDb[]).map(parseMenuItem);
    }
    const msg = error.message.toLowerCase();
    if (msg.includes("seccion") && msg.includes("column")) {
      lastError = error;
      continue;
    }
    throw new Error(formatPostgrestError(error));
  }
  throw new Error(
    lastError ? formatPostgrestError(lastError as never) : "No se pudo leer el menú."
  );
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

  const [menuItems, checklistRes] = await Promise.all([
    fetchMenuItems(id),
    supabase
      .from("evento_checklist_items")
      .select(EVENTO_CHECKLIST_SELECT)
      .eq("evento_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (checklistRes.error) throw new Error(formatPostgrestError(checklistRes.error));

  const checklistItems = await backfillCategoriasChecklist(
    (checklistRes.data ?? []) as EventoChecklistItemDb[]
  );

  return {
    ...parseEvento(eventoRow as EventoDb),
    menuItems,
    checklistItems,
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

  const checklistPayload = CHECKLIST_PLANTILLA_EVENTO.map((item, index) => ({
    evento_id: evento.id,
    titulo: item.titulo,
    orden: (index + 1) * 10,
    categoria: item.categoria,
    unidad: "unidad",
    cantidad: 1,
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

type PlatoRef = { id: string; nombre: string; categoria: string };

/** Guarda el menú Omakase (17 pases + regalos). Conserva ítems `extra`. */
export async function guardarMenuOmakaseEvento(
  eventoId: string,
  slots: EventoMenuOmakaseSlots,
  platosPorId: Map<string, PlatoRef>
): Promise<EventoMenuItem[]> {
  const existentes = await fetchMenuItems(eventoId);
  const extras = extrasDesdeMenuItems(existentes);
  const extraIds = new Set(extras.map((e) => e.id));
  const idsBorrar = existentes.filter((i) => !extraIds.has(i.id)).map((i) => i.id);

  if (idsBorrar.length > 0) {
    const { error: delError } = await supabase
      .from("evento_menu_items")
      .delete()
      .in("id", idsBorrar);
    if (delError) throw new Error(formatPostgrestError(delError));
  }

  const filas: Array<{
    evento_id: string;
    plato_id: string;
    plato_nombre: string;
    categoria: string;
    seccion: EventoMenuSeccion;
    orden: number;
    cantidad: number;
  }> = [];

  let orden = 10;
  const pushSeccion = (
    seccion: EventoMenuSeccion,
    ids: string[],
    categoriaFallback: string
  ) => {
    for (const id of ids) {
      const platoId = id.trim();
      if (!platoId) continue;
      const plato = platosPorId.get(platoId);
      if (!plato) continue;
      filas.push({
        evento_id: eventoId,
        plato_id: plato.id,
        plato_nombre: plato.nombre,
        categoria: plato.categoria || categoriaFallback,
        seccion,
        orden,
        cantidad: 1,
      });
      orden += 10;
    }
  };

  if (!slots.nigiriOnly) {
    pushSeccion("otsumami", slots.otsumami, "Otsumami");
  }
  pushSeccion("nigiri", slots.nigiri, "Nigiri");
  if (!slots.nigiriOnly) {
    pushSeccion("postre", slots.postre, "Postre");
    pushSeccion("regalo", slots.regalo, "Otsumami");
  }

  if (filas.length > 0) {
    const { error: insertError } = await supabase.from("evento_menu_items").insert(filas);
    if (insertError) throw new Error(formatPostgrestError(insertError));
  }

  return fetchMenuItems(eventoId);
}

export async function crearEventoMenuItem(input: {
  eventoId: string;
  platoId?: string | null;
  platoNombre: string;
  categoria?: string | null;
  seccion?: EventoMenuSeccion | null;
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
      seccion: input.seccion ?? "extra",
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
  cantidad?: number;
  unidad?: string | null;
  categoria?: EventoChecklistCategoria | null;
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

  const cantidad =
    input.cantidad != null && input.cantidad > 0 ? Math.floor(input.cantidad) : 1;
  const unidad = input.unidad?.trim() || "unidad";
  const categoria =
    input.categoria && esCategoriaChecklist(input.categoria)
      ? input.categoria
      : inferirCategoriaChecklist(titulo);

  const { data, error } = await supabase
    .from("evento_checklist_items")
    .insert({
      evento_id: input.eventoId,
      titulo,
      orden,
      cantidad,
      unidad,
      categoria,
    })
    .select(EVENTO_CHECKLIST_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseChecklistItem(data as EventoChecklistItemDb);
}

export async function actualizarCantidadChecklistItem(
  id: string,
  cantidad: number
): Promise<EventoChecklistItem> {
  const valor = Number.isFinite(cantidad) && cantidad > 0 ? Math.floor(cantidad) : 1;
  const { data, error } = await supabase
    .from("evento_checklist_items")
    .update({ cantidad: valor })
    .eq("id", id)
    .select(EVENTO_CHECKLIST_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseChecklistItem(data as EventoChecklistItemDb);
}

export async function actualizarUnidadChecklistItem(
  id: string,
  unidad: string
): Promise<EventoChecklistItem> {
  const valor = unidad.trim() || "unidad";
  const { data, error } = await supabase
    .from("evento_checklist_items")
    .update({ unidad: valor })
    .eq("id", id)
    .select(EVENTO_CHECKLIST_SELECT)
    .single();

  if (error) throw new Error(formatPostgrestError(error));
  return parseChecklistItem(data as EventoChecklistItemDb);
}

export async function actualizarCategoriaChecklistItem(
  id: string,
  categoria: EventoChecklistCategoria
): Promise<EventoChecklistItem> {
  const valor = esCategoriaChecklist(categoria) ? categoria : "otros";
  const { data, error } = await supabase
    .from("evento_checklist_items")
    .update({ categoria: valor })
    .eq("id", id)
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

/**
 * Agrega a la checklist los insumos únicos de los platos del menú
 * (no borra ítems existentes de logística/equipo).
 */
export async function sincronizarChecklistDesdeMenu(
  eventoId: string
): Promise<{ checklist: EventoChecklistItem[]; agregados: number }> {
  const { consolidarNecesidades, fetchNecesidadesPorPlatos } = await import(
    "@/src/lib/plato-necesidades"
  );

  const menuItems = await fetchMenuItems(eventoId);
  const platoIds = menuItems
    .map((m) => m.platoId)
    .filter((id): id is string => Boolean(id));

  const necesidades = await fetchNecesidadesPorPlatos(platoIds);
  const unicos = consolidarNecesidades(necesidades);

  const { data: checklistRows, error: checklistError } = await supabase
    .from("evento_checklist_items")
    .select(EVENTO_CHECKLIST_SELECT)
    .eq("evento_id", eventoId)
    .order("orden", { ascending: true });

  if (checklistError) throw new Error(formatPostgrestError(checklistError));

  const actuales = ((checklistRows ?? []) as EventoChecklistItemDb[]).map(
    parseChecklistItem
  );
  const existentes = new Set(actuales.map((c) => c.titulo.trim().toLowerCase()));
  const maxOrden = actuales.reduce((m, c) => Math.max(m, c.orden), 0);

  const aInsertar = unicos.filter((item) => !existentes.has(item.toLowerCase()));
  if (aInsertar.length === 0) {
    return { checklist: actuales, agregados: 0 };
  }

  const payload = aInsertar.map((titulo, index) => ({
    evento_id: eventoId,
    titulo,
    orden: maxOrden + (index + 1) * 10,
    cantidad: 1,
    unidad: "unidad",
    categoria: inferirCategoriaChecklist(titulo),
  }));

  const { data: nuevos, error: insertError } = await supabase
    .from("evento_checklist_items")
    .insert(payload)
    .select(EVENTO_CHECKLIST_SELECT);

  if (insertError) throw new Error(formatPostgrestError(insertError));

  const checklist = [
    ...actuales,
    ...((nuevos ?? []) as EventoChecklistItemDb[]).map(parseChecklistItem),
  ].sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"));

  return { checklist, agregados: aInsertar.length };
}

export function slotsVaciosMenuOmakase(): EventoMenuOmakaseSlots {
  return slotsVacios();
}
