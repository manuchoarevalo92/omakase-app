"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  List,
  Luggage,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  SearchX,
  Trash2,
} from "lucide-react";

import {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  CampoBusqueda,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fecha,
  Fila,
  Hoja,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
  cx,
  useAvisos,
  vibrar,
  type OpcionSelector,
} from "@/app/ui";
import { EventoMenuOmakase } from "@/app/components/evento-menu-omakase";
import { EventoMenuNecesidades } from "@/app/components/evento-menu-necesidades";
import {
  actualizarEvento,
  actualizarCantidadChecklistItem,
  actualizarCategoriaChecklistItem,
  actualizarTituloChecklistItem,
  actualizarUnidadChecklistItem,
  agruparChecklistPorCategoria,
  contarPasosMenu,
  crearEvento,
  crearEventoChecklistItem,
  crearEventoMenuItem,
  eliminarEvento,
  eliminarEventoChecklistItem,
  eliminarEventoMenuItem,
  ETIQUETA_CHECKLIST_CATEGORIA,
  ETIQUETA_EVENTO_ESTADO,
  EVENTO_CHECKLIST_CATEGORIAS,
  EVENTO_CHECKLIST_UNIDADES,
  EVENTO_ESTADOS,
  extrasDesdeMenuItems,
  fetchEventoDetalle,
  fetchEventos,
  guardarMenuOmakaseEvento,
  inferirCategoriaChecklist,
  progresoChecklist,
  slotsDesdeMenuItems,
  slotsVaciosMenuOmakase,
  sincronizarChecklistDesdeMenu,
  toggleEventoChecklistEnValija,
  toggleEventoChecklistItem,
  type Evento,
  type EventoChecklistCategoria,
  type EventoChecklistItem,
  type EventoDetalle,
  type EventoEstado,
  type EventoMenuItem,
  type EventoMenuOmakaseSlots,
} from "@/src/lib/eventos";
import { supabase } from "@/src/lib/supabase";

type PlatoCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
};

function formatFechaLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function horaLocalHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function etiquetaFechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function EventosPage() {
  const now = new Date();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [detalle, setDetalle] = useState<EventoDetalle | null>(null);
  const [platos, setPlatos] = useState<PlatoCatalogo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aviso, confirmar } = useAvisos();
  /** Pestaña del detalle: checklist para armar la valija o el menú. */
  const [vista, setVista] = useState<"llevar" | "menu">("llevar");
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoFecha, setNuevoFecha] = useState(() =>
    formatFechaLocalYYYYMMDD(now),
  );
  const [nuevoHora, setNuevoHora] = useState(() => horaLocalHHmm(now));
  const [nuevoLugar, setNuevoLugar] = useState("");
  const [nuevoComensales, setNuevoComensales] = useState("");

  const [platoSeleccionado, setPlatoSeleccionado] = useState("");
  const [menuLibre, setMenuLibre] = useState("");
  const [checklistNuevo, setChecklistNuevo] = useState("");
  const [checklistCantidadNueva, setChecklistCantidadNueva] = useState("1");
  const [checklistUnidadNueva, setChecklistUnidadNueva] = useState("unidad");
  const [checklistCategoriaNueva, setChecklistCategoriaNueva] =
    useState<EventoChecklistCategoria>("otros");
  const [checklistBusqueda, setChecklistBusqueda] = useState("");
  const [menuSlots, setMenuSlots] = useState<EventoMenuOmakaseSlots>(() =>
    slotsVaciosMenuOmakase(),
  );
  /** Como en el Omakase diario: tras guardar, vista lista; editar vuelve al formulario. */
  const [menuVistaLista, setMenuVistaLista] = useState(false);

  const eventosProximos = useMemo(() => {
    const hoy = formatFechaLocalYYYYMMDD(new Date());
    const activos = eventos.filter(
      (e) => e.estado !== "cancelado" && e.estado !== "completado",
    );
    const futuros = activos.filter((e) => e.fecha >= hoy);
    const pasados = activos.filter((e) => e.fecha < hoy);
    const cerrados = eventos.filter(
      (e) => e.estado === "completado" || e.estado === "cancelado",
    );
    return { futuros, pasados, cerrados };
  }, [eventos]);

  const platosPorId = useMemo(
    () => new Map(platos.map((p) => [p.id, p])),
    [platos],
  );

  const extrasMenu = useMemo(
    () => (detalle ? extrasDesdeMenuItems(detalle.menuItems) : []),
    [detalle],
  );

  const progreso = useMemo(
    () =>
      detalle
        ? progresoChecklist(detalle.checklistItems)
        : { total: 0, listos: 0, enValija: 0 },
    [detalle],
  );

  const checklistPorCategoria = useMemo(() => {
    if (!detalle) return [];
    const q = checklistBusqueda.trim().toLowerCase();
    const items = q
      ? detalle.checklistItems.filter((item) => {
          const titulo = item.titulo.toLowerCase();
          const cat =
            ETIQUETA_CHECKLIST_CATEGORIA[item.categoria]?.toLowerCase() ?? "";
          const unidad = item.unidad.toLowerCase();
          return titulo.includes(q) || cat.includes(q) || unidad.includes(q);
        })
      : detalle.checklistItems;
    return agruparChecklistPorCategoria(items);
  }, [detalle, checklistBusqueda]);

  const checklistFiltradosCount = useMemo(
    () => checklistPorCategoria.reduce((acc, b) => acc + b.items.length, 0),
    [checklistPorCategoria],
  );

  const cargarLista = useCallback(async () => {
    setEventos(await fetchEventos());
  }, []);

  const cargarDetalle = useCallback(async (id: string) => {
    const data = await fetchEventoDetalle(id);
    setDetalle(data);
    if (data) {
      setMenuSlots(slotsDesdeMenuItems(data.menuItems));
      setMenuVistaLista(data.menuItems.length > 0);
    } else {
      setMenuSlots(slotsVaciosMenuOmakase());
      setMenuVistaLista(false);
    }
    return data;
  }, []);

  const cargarDatos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [lista, platosRes] = await Promise.all([
        fetchEventos(),
        supabase
          .from("platos")
          .select("id, nombre, categoria")
          .eq("tipo", "carta")
          .order("categoria")
          .order("nombre"),
      ]);
      setEventos(lista);
      if (platosRes.error) throw platosRes.error;
      setPlatos((platosRes.data as PlatoCatalogo[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar eventos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cargarDatos]);

  const abrirEvento = async (id: string) => {
    setError(null);
    setMostrarNuevo(false);
    try {
      const data = await cargarDetalle(id);
      setVista(data && data.menuItems.length === 0 ? "menu" : "llevar");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo abrir el evento.",
      );
    }
  };

  const volverALista = () => {
    setDetalle(null);
    setMenuSlots(slotsVaciosMenuOmakase());
    setMenuVistaLista(false);
    setChecklistBusqueda("");
    setEditandoDatos(false);
    setItemEditandoId(null);
    setError(null);
    void cargarLista();
  };

  const crearNuevoEvento = async (event: FormEvent) => {
    event.preventDefault();
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;

    setIsSaving(true);
    setError(null);
    try {
      const creado = await crearEvento({
        titulo,
        fecha: nuevoFecha,
        hora: nuevoHora,
        lugar: nuevoLugar.trim() || null,
        comensales: nuevoComensales.trim() ? Number(nuevoComensales) : null,
      });
      await cargarLista();
      setDetalle(creado);
      setMenuSlots(slotsVaciosMenuOmakase());
      setMostrarNuevo(false);
      setNuevoTitulo("");
      setNuevoLugar("");
      setNuevoComensales("");
      setVista("menu");
      aviso("Evento creado. Ahora armá el menú.", { tono: "exito" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el evento.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const guardarCabecera = async (): Promise<boolean> => {
    if (!detalle) return false;
    setIsSaving(true);
    setError(null);
    try {
      const actualizado = await actualizarEvento(detalle.id, {
        titulo: detalle.titulo,
        fecha: detalle.fecha,
        hora: detalle.hora,
        lugar: detalle.lugar,
        comensales: detalle.comensales,
        estado: detalle.estado,
        notas: detalle.notas,
      });
      setDetalle((prev) => (prev ? { ...prev, ...actualizado } : prev));
      await cargarLista();
      aviso("Evento actualizado.", { tono: "exito" });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const borrarEvento = async () => {
    if (!detalle) return;
    const ok = await confirmar({
      titulo: `¿Eliminar «${detalle.titulo}»?`,
      texto: "No se puede deshacer.",
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setIsSaving(true);
    setError(null);
    try {
      await eliminarEvento(detalle.id);
      volverALista();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
      setIsSaving(false);
    }
  };

  const guardarMenuOmakase = async () => {
    if (!detalle) return;
    const conteo = contarPasosMenu(menuSlots);
    if (conteo.base === 0) {
      setError("Elegí al menos un pase del menú antes de guardar.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const menuItems = await guardarMenuOmakaseEvento(
        detalle.id,
        menuSlots,
        platosPorId,
      );
      const { checklist, agregados } = await sincronizarChecklistDesdeMenu(
        detalle.id,
      );
      let estado = detalle.estado;
      if (estado === "borrador") {
        const actualizado = await actualizarEvento(detalle.id, {
          estado: "confirmado",
        });
        estado = actualizado.estado;
      }
      setDetalle((prev) =>
        prev ? { ...prev, menuItems, checklistItems: checklist, estado } : prev,
      );
      setMenuVistaLista(true);
      aviso(
        `Menú guardado: ${conteo.base}/${conteo.baseObjetivo} base` +
          (!menuSlots.nigiriOnly && conteo.regalo > 0
            ? ` + ${conteo.regalo} regalo`
            : "") +
          (agregados > 0 ? ` · checklist +${agregados} insumos` : "") +
          (estado === "confirmado" ? " · estado Guardado" : "") +
          ".",
        { tono: "exito" },
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el menú.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const agregarExtraPlato = async (platoId: string) => {
    if (!detalle || !platoId) return;
    const plato = platosPorId.get(platoId);
    if (!plato) return;
    setIsSaving(true);
    setError(null);
    try {
      const item = await crearEventoMenuItem({
        eventoId: detalle.id,
        platoId: plato.id,
        platoNombre: plato.nombre,
        categoria: plato.categoria,
        seccion: "extra",
      });
      setDetalle((prev) =>
        prev ? { ...prev, menuItems: [...prev.menuItems, item] } : prev,
      );
      setPlatoSeleccionado("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo agregar extra.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const agregarMenuLibre = async (nombre: string) => {
    if (!detalle || !nombre.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const item = await crearEventoMenuItem({
        eventoId: detalle.id,
        platoNombre: nombre.trim(),
        seccion: "extra",
      });
      setDetalle((prev) =>
        prev ? { ...prev, menuItems: [...prev.menuItems, item] } : prev,
      );
      setMenuLibre("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo agregar al menú.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const quitarMenuItem = async (item: EventoMenuItem) => {
    if (!detalle) return;
    setIsSaving(true);
    setError(null);
    try {
      await eliminarEventoMenuItem(item.id);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              menuItems: prev.menuItems.filter((m) => m.id !== item.id),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo quitar del menú.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const agregarChecklist = async () => {
    if (!detalle || !checklistNuevo.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const cantidad = Number(checklistCantidadNueva);
      const item = await crearEventoChecklistItem({
        eventoId: detalle.id,
        titulo: checklistNuevo.trim(),
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
        unidad: checklistUnidadNueva,
        categoria: checklistCategoriaNueva,
      });
      setDetalle((prev) =>
        prev
          ? { ...prev, checklistItems: [...prev.checklistItems, item] }
          : prev,
      );
      setChecklistNuevo("");
      setChecklistCantidadNueva("1");
      setChecklistUnidadNueva("unidad");
      setChecklistCategoriaNueva("otros");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar ítem.");
    } finally {
      setIsSaving(false);
    }
  };

  const cambiarCantidadChecklist = async (itemId: string, raw: string) => {
    if (!detalle) return;
    const parsed = Number(raw);
    const cantidad =
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, cantidad } : i,
            ),
          }
        : prev,
    );
    try {
      const actualizado = await actualizarCantidadChecklistItem(
        itemId,
        cantidad,
      );
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la cantidad.",
      );
    }
  };

  const cambiarTituloChecklist = async (itemId: string, raw: string) => {
    if (!detalle) return;
    const titulo = raw.trim();
    if (!titulo) {
      setError("El nombre del ítem no puede quedar vacío.");
      return;
    }
    const actual = detalle.checklistItems.find((i) => i.id === itemId);
    if (actual && actual.titulo === titulo) return;

    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, titulo } : i,
            ),
          }
        : prev,
    );
    try {
      const actualizado = await actualizarTituloChecklistItem(itemId, titulo);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el nombre.",
      );
    }
  };

  const cambiarUnidadChecklist = async (itemId: string, unidad: string) => {
    if (!detalle) return;
    const valor = unidad.trim() || "unidad";
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, unidad: valor } : i,
            ),
          }
        : prev,
    );
    try {
      const actualizado = await actualizarUnidadChecklistItem(itemId, valor);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar la unidad.",
      );
    }
  };

  const cambiarCategoriaChecklist = async (
    itemId: string,
    categoria: EventoChecklistCategoria,
  ) => {
    if (!detalle) return;
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, categoria } : i,
            ),
          }
        : prev,
    );
    try {
      const actualizado = await actualizarCategoriaChecklistItem(
        itemId,
        categoria,
      );
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la categoría.",
      );
    }
  };

  const sincronizarChecklist = async () => {
    if (!detalle) return;
    setIsSaving(true);
    setError(null);
    try {
      const { checklist, agregados } = await sincronizarChecklistDesdeMenu(
        detalle.id,
      );
      setDetalle((prev) =>
        prev ? { ...prev, checklistItems: checklist } : prev,
      );
      aviso(
        agregados > 0
          ? `Checklist actualizada: +${agregados} insumos desde el menú.`
          : "Checklist al día: no había insumos nuevos.",
        { tono: agregados > 0 ? "exito" : "neutro" },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar la checklist.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChecklist = async (itemId: string) => {
    if (!detalle) return;
    const item = detalle.checklistItems.find((i) => i.id === itemId);
    if (!item) return;
    setError(null);
    try {
      const actualizado = await toggleEventoChecklistItem(
        item,
        !item.completado,
      );
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  };

  const toggleValija = async (itemId: string) => {
    if (!detalle) return;
    const item = detalle.checklistItems.find((i) => i.id === itemId);
    if (!item) return;
    setError(null);
    const next = !item.enValija;
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, enValija: next } : i,
            ),
          }
        : prev,
    );
    try {
      const actualizado = await toggleEventoChecklistEnValija(item, next);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i,
              ),
            }
          : prev,
      );
    } catch (err) {
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? item : i,
              ),
            }
          : prev,
      );
      setError(
        err instanceof Error ? err.message : "No se pudo marcar la valija.",
      );
    }
  };

  const quitarChecklist = async (id: string) => {
    if (!detalle) return;
    setError(null);
    try {
      await eliminarEventoChecklistItem(id);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.filter((i) => i.id !== id),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  // Callbacks estables: Hoja re-ejecuta su efecto de foco si cambia onCerrar.
  const cerrarDatos = useCallback(() => setEditandoDatos(false), []);
  const cerrarNuevo = useCallback(() => setMostrarNuevo(false), []);
  const cerrarItem = useCallback(() => setItemEditandoId(null), []);

  const bloqueError = error ? (
    <div
      role="alert"
      className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
    >
      <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{error}</p>
    </div>
  ) : null;

  if (detalle) {
    const itemEditando = itemEditandoId
      ? (detalle.checklistItems.find((i) => i.id === itemEditandoId) ?? null)
      : null;
    const todoEnValija =
      progreso.total > 0 && progreso.enValija === progreso.total;
    const busqueda = checklistBusqueda.trim();
    const opcionesEstado: OpcionSelector<EventoEstado>[] = EVENTO_ESTADOS.map(
      (estado) => ({ valor: estado, label: ETIQUETA_EVENTO_ESTADO[estado] }),
    );

    return (
      <Pantalla
        titulo={detalle.titulo || "Evento"}
        subtitulo={[
          etiquetaFechaCorta(detalle.fecha),
          detalle.hora ? detalle.hora.slice(0, 5) : null,
          detalle.comensales ? `${detalle.comensales} pax` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acciones={
          <BotonIcono
            etiqueta="Volver a la lista"
            icono={<List className="h-[22px] w-[22px]" aria-hidden />}
            onClick={volverALista}
          />
        }
        ayuda={
          <>
            <p>
              <strong className="text-label">Qué llevar</strong> es la checklist
              para armar la valija: tocá la fila para marcarla{" "}
              <strong className="text-label">en la valija</strong> (otro toque
              la saca). <strong className="text-label">Listo</strong> marca que
              ya está preparado.
            </p>
            <p>
              Con <strong className="text-label">Del menú</strong> se suman los
              insumos de los platos del menú que todavía no están en la lista.
              Con los tres puntos de cada fila cambiás nombre, cantidad, unidad
              o categoría, o lo borrás.
            </p>
            <p>
              En <strong className="text-label">Menú</strong> se arma el menú
              Omakase del evento. Ya guardado, tocá un plato para ver qué
              necesita; el tilde de cada insumo es el mismo «Listo» de la
              checklist.
            </p>
          </>
        }
      >
        {bloqueError}

        <button
          type="button"
          onClick={() => {
            vibrar();
            setEditandoDatos(true);
          }}
          className="flex min-h-14 w-full items-center gap-3 rounded-card bg-surface-3 py-3 pl-4 pr-3 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition active:bg-fill"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] leading-snug text-label">
              {detalle.lugar || "Sin lugar"}
            </span>
            {detalle.notas ? (
              <span className="mt-0.5 line-clamp-2 block whitespace-pre-line text-[0.86rem] leading-snug text-label-3">
                {detalle.notas}
              </span>
            ) : null}
          </span>
          <Etiqueta tono={TONO_ESTADO[detalle.estado]}>
            {ETIQUETA_EVENTO_ESTADO[detalle.estado]}
          </Etiqueta>
          <Pencil
            className="h-[18px] w-[18px] shrink-0 text-label-3"
            aria-hidden
          />
        </button>

        <div className="mt-4">
          <Segmentado
            etiqueta="Sección del evento"
            valor={vista}
            onChange={setVista}
            opciones={[
              {
                valor: "llevar",
                label: (
                  <>
                    Qué llevar
                    {progreso.total > 0 ? (
                      <span className="tabular-nums text-label-3">
                        {progreso.enValija}/{progreso.total}
                      </span>
                    ) : null}
                  </>
                ),
              },
              { valor: "menu", label: "Menú" },
            ]}
          />
        </div>

        {vista === "llevar" ? (
          <div className="mt-4">
            {progreso.total > 0 ? (
              <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20 sm:top-3">
                <div
                  className={cx(
                    "rounded-card px-4 py-3 shadow-[0_6px_20px_rgb(0_0_0/0.14)] transition-colors",
                    todoEnValija ? "bg-success-soft" : "bg-surface-3",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[0.94rem] text-label-2">
                      {todoEnValija ? (
                        <span className="font-semibold text-success">
                          Todo en la valija
                        </span>
                      ) : (
                        <>
                          <span className="text-[1.1rem] font-semibold tabular-nums text-label">
                            {progreso.enValija}/{progreso.total}
                          </span>{" "}
                          en la valija
                        </>
                      )}
                    </p>
                    <p className="text-[0.84rem] tabular-nums text-label-3">
                      {progreso.listos}/{progreso.total} listos
                    </p>
                  </div>
                  <div
                    className="mt-2.5 h-2 overflow-hidden rounded-full bg-fill"
                    role="progressbar"
                    aria-label="Ítems en la valija"
                    aria-valuenow={progreso.enValija}
                    aria-valuemin={0}
                    aria-valuemax={progreso.total}
                  >
                    <div
                      className="h-full rounded-full bg-success transition-all duration-300"
                      style={{
                        width: `${(progreso.enValija / Math.max(progreso.total, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <CampoBusqueda
                  value={checklistBusqueda}
                  onChange={(e) => setChecklistBusqueda(e.target.value)}
                  placeholder="Buscar en la checklist"
                  etiqueta="Buscar en la checklist"
                />
              </div>
              <Boton
                variante="secundario"
                className="min-h-12 shrink-0"
                icono={<RefreshCw className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void sincronizarChecklist()}
                disabled={isSaving}
                title="Suma los insumos de los platos del menú que falten"
              >
                Del menú
              </Boton>
            </div>
            {busqueda && checklistPorCategoria.length > 0 ? (
              <p className="mt-2 px-1 text-[0.84rem] text-label-3">
                Mostrando {checklistFiltradosCount} de {progreso.total}
              </p>
            ) : null}

            {checklistPorCategoria.length === 0 ? (
              <div className="mt-6 rounded-card bg-surface-3">
                {busqueda ? (
                  <EstadoVacio
                    icono={<SearchX className="h-6 w-6" aria-hidden />}
                    titulo="Sin resultados"
                    texto={`Nada coincide con «${busqueda}».`}
                  />
                ) : (
                  <EstadoVacio
                    icono={<Luggage className="h-6 w-6" aria-hidden />}
                    titulo="La checklist está vacía"
                    texto="Agregá ítems abajo o sumá los insumos del menú con «Del menú»."
                  />
                )}
              </div>
            ) : (
              checklistPorCategoria.map((bloque) => {
                const valijaBloque = bloque.items.filter(
                  (i) => i.enValija,
                ).length;
                const completo = valijaBloque === bloque.items.length;
                return (
                  <Seccion
                    key={bloque.categoria}
                    titulo={bloque.etiqueta}
                    accion={
                      <span
                        className={cx(
                          "text-[0.8rem] tabular-nums",
                          completo
                            ? "font-semibold text-success"
                            : "text-label-3",
                        )}
                      >
                        {valijaBloque}/{bloque.items.length} en valija
                      </span>
                    }
                  >
                    <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                      {bloque.items.map((item) => (
                        <FilaChecklist
                          key={item.id}
                          item={item}
                          onValija={() => void toggleValija(item.id)}
                          onListo={() => void toggleChecklist(item.id)}
                          onEditar={() => setItemEditandoId(item.id)}
                        />
                      ))}
                    </ul>
                  </Seccion>
                );
              })
            )}

            <Seccion titulo="Agregar ítem">
              <div className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                <Campo
                  aria-label="Nombre del nuevo ítem"
                  value={checklistNuevo}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setChecklistNuevo(valor);
                    if (valor.trim()) {
                      setChecklistCategoriaNueva(
                        inferirCategoriaChecklist(valor),
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void agregarChecklist();
                    }
                  }}
                  enterKeyHint="done"
                  placeholder="Qué hay que llevar…"
                />
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                  <Campo
                    label="Cantidad"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={checklistCantidadNueva}
                    onChange={(e) => setChecklistCantidadNueva(e.target.value)}
                    className="text-center tabular-nums"
                  />
                  <Selector
                    label="Unidad"
                    valor={checklistUnidadNueva}
                    opciones={EVENTO_CHECKLIST_UNIDADES.map((u) => ({
                      valor: u as string,
                      label: u,
                    }))}
                    onChange={setChecklistUnidadNueva}
                  />
                </div>
                <Selector
                  label="Categoría"
                  valor={checklistCategoriaNueva}
                  opciones={OPCIONES_CATEGORIA}
                  onChange={setChecklistCategoriaNueva}
                />
                <Boton
                  variante="secundario"
                  ancho
                  icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => void agregarChecklist()}
                  disabled={isSaving || !checklistNuevo.trim()}
                >
                  Agregar a la checklist
                </Boton>
              </div>
            </Seccion>
          </div>
        ) : menuVistaLista && detalle.menuItems.length > 0 ? (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-card bg-fill py-1 pl-4 pr-1">
              <p className="min-w-0 flex-1 text-[0.9rem] leading-snug text-label-2">
                Menú guardado. Tocá un plato para ver qué lleva.
              </p>
              <Boton
                variante="terciario"
                icono={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => setMenuVistaLista(false)}
              >
                Editar
              </Boton>
            </div>
            <EventoMenuNecesidades
              menuItems={detalle.menuItems}
              checklistItems={detalle.checklistItems}
              onToggleChecklistItem={(id) => void toggleChecklist(id)}
            />
          </>
        ) : (
          <>
            {detalle.menuItems.length > 0 ? (
              <div className="mt-4 flex items-center gap-2 rounded-card bg-fill py-1 pl-4 pr-1">
                <p className="min-w-0 flex-1 text-[0.9rem] leading-snug text-label-2">
                  Editando el menú del evento
                </p>
                <Boton
                  variante="terciario"
                  icono={<List className="h-4 w-4" aria-hidden />}
                  onClick={() => setMenuVistaLista(true)}
                >
                  Ver menú
                </Boton>
              </div>
            ) : null}
            <div className="mt-4">
              <EventoMenuOmakase
                slots={menuSlots}
                onSlotsChange={setMenuSlots}
                platos={platos}
                extras={extrasMenu}
                isSaving={isSaving}
                onGuardarMenu={() => void guardarMenuOmakase()}
                onAgregarExtra={(id) => void agregarExtraPlato(id)}
                onAgregarLibre={(nombre) => void agregarMenuLibre(nombre)}
                onQuitarExtra={(item) => void quitarMenuItem(item)}
                extraPlatoId={platoSeleccionado}
                onExtraPlatoIdChange={setPlatoSeleccionado}
                extraLibre={menuLibre}
                onExtraLibreChange={setMenuLibre}
              />
            </div>
          </>
        )}

        <Hoja
          abierta={editandoDatos}
          onCerrar={cerrarDatos}
          titulo="Datos del evento"
        >
          <div className="space-y-3 pb-2">
            {bloqueError}
            <Campo
              label="Título"
              value={detalle.titulo}
              onChange={(e) =>
                setDetalle((prev) =>
                  prev ? { ...prev, titulo: e.target.value } : prev,
                )
              }
            />
            <Fecha
              label="Fecha"
              valor={detalle.fecha}
              onChange={(iso) =>
                setDetalle((prev) => (prev ? { ...prev, fecha: iso } : prev))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="Hora"
                type="time"
                value={detalle.hora ?? ""}
                onChange={(e) =>
                  setDetalle((prev) =>
                    prev ? { ...prev, hora: e.target.value || null } : prev,
                  )
                }
                className="tabular-nums"
              />
              <Campo
                label="Comensales"
                type="number"
                min={1}
                inputMode="numeric"
                value={detalle.comensales ?? ""}
                onChange={(e) =>
                  setDetalle((prev) =>
                    prev
                      ? {
                          ...prev,
                          comensales: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }
                      : prev,
                  )
                }
                className="tabular-nums"
              />
            </div>
            <Campo
              label="Lugar"
              value={detalle.lugar ?? ""}
              onChange={(e) =>
                setDetalle((prev) =>
                  prev ? { ...prev, lugar: e.target.value || null } : prev,
                )
              }
              placeholder="Domicilio, salón, etc."
            />
            <Selector
              label="Estado"
              valor={detalle.estado}
              opciones={opcionesEstado}
              onChange={(estado) =>
                setDetalle((prev) => (prev ? { ...prev, estado } : prev))
              }
            />
            <AreaTexto
              label="Notas"
              rows={3}
              value={detalle.notas ?? ""}
              onChange={(e) =>
                setDetalle((prev) =>
                  prev ? { ...prev, notas: e.target.value || null } : prev,
                )
              }
            />
            <div className="space-y-2 pt-2">
              <Boton
                ancho
                tamano="grande"
                cargando={isSaving}
                icono={<Check className="h-[18px] w-[18px]" aria-hidden />}
                onClick={async () => {
                  if (await guardarCabecera()) setEditandoDatos(false);
                }}
              >
                Guardar
              </Boton>
              <Boton
                ancho
                variante="peligro"
                disabled={isSaving}
                icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void borrarEvento()}
              >
                Eliminar evento
              </Boton>
            </div>
          </div>
        </Hoja>

        {itemEditando ? (
          <HojaItemChecklist
            key={itemEditando.id}
            item={itemEditando}
            onCerrar={cerrarItem}
            onTitulo={(raw) =>
              void cambiarTituloChecklist(itemEditando.id, raw)
            }
            onCantidad={(raw) =>
              void cambiarCantidadChecklist(itemEditando.id, raw)
            }
            onUnidad={(u) => void cambiarUnidadChecklist(itemEditando.id, u)}
            onCategoria={(c) =>
              void cambiarCategoriaChecklist(itemEditando.id, c)
            }
            onValija={() => void toggleValija(itemEditando.id)}
            onEliminar={() => {
              setItemEditandoId(null);
              void quitarChecklist(itemEditando.id);
            }}
          />
        ) : null}
      </Pantalla>
    );
  }

  const totalActivos =
    eventosProximos.futuros.length + eventosProximos.pasados.length;

  return (
    <Pantalla
      titulo="Eventos"
      subtitulo={
        isLoading
          ? "Cargando…"
          : eventos.length === 0
            ? "Sin eventos"
            : totalActivos === 0
              ? "Nada pendiente"
              : `${totalActivos} ${totalActivos === 1 ? "evento pendiente" : "eventos pendientes"}`
      }
      acciones={
        <BotonIcono
          etiqueta="Nuevo evento"
          icono={<Plus className="h-[22px] w-[22px]" aria-hidden />}
          onClick={() => {
            setMostrarNuevo(true);
            setError(null);
          }}
        />
      }
      ayuda={
        <>
          <p>
            Cada evento o catering tiene su propio menú Omakase y una checklist
            de qué llevar.
          </p>
          <p>
            Creá uno con el <strong className="text-label">+</strong>: arranca
            con una checklist base. Después armá el menú y sumá sus insumos a la
            checklist.
          </p>
          <p>
            Los eventos con fecha pasada que no se marcaron como completados o
            cancelados quedan en{" "}
            <strong className="text-label">Pendientes</strong>.
          </p>
        </>
      }
    >
      {mostrarNuevo ? null : bloqueError}

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : eventos.length === 0 ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<CalendarDays className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay eventos"
            texto="Creá el primero para armar su menú y la checklist de qué llevar."
            accion={
              <Boton
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => {
                  setMostrarNuevo(true);
                  setError(null);
                }}
              >
                Nuevo evento
              </Boton>
            }
          />
        </div>
      ) : (
        <>
          {eventosProximos.futuros.length > 0 ? (
            <ListaEventos
              titulo="Próximos"
              eventos={eventosProximos.futuros}
              onAbrir={abrirEvento}
            />
          ) : null}
          {eventosProximos.pasados.length > 0 ? (
            <ListaEventos
              titulo="Pendientes (fecha pasada)"
              eventos={eventosProximos.pasados}
              onAbrir={abrirEvento}
            />
          ) : null}
          {eventosProximos.cerrados.length > 0 ? (
            <ListaEventos
              titulo="Completados y cancelados"
              eventos={eventosProximos.cerrados}
              onAbrir={abrirEvento}
              atenuado
            />
          ) : null}
        </>
      )}

      <Hoja abierta={mostrarNuevo} onCerrar={cerrarNuevo} titulo="Nuevo evento">
        <form onSubmit={crearNuevoEvento} className="space-y-3 pb-2">
          {bloqueError}
          <Campo
            label="Título"
            value={nuevoTitulo}
            onChange={(e) => setNuevoTitulo(e.target.value)}
            placeholder="Ej. Cena privada García"
            required
          />
          <Fecha label="Fecha" valor={nuevoFecha} onChange={setNuevoFecha} />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Hora"
              type="time"
              value={nuevoHora}
              onChange={(e) => setNuevoHora(e.target.value)}
              className="tabular-nums"
            />
            <Campo
              label="Comensales"
              type="number"
              min={1}
              inputMode="numeric"
              value={nuevoComensales}
              onChange={(e) => setNuevoComensales(e.target.value)}
              placeholder="Opcional"
              className="tabular-nums"
            />
          </div>
          <Campo
            label="Lugar"
            value={nuevoLugar}
            onChange={(e) => setNuevoLugar(e.target.value)}
            placeholder="Opcional"
          />
          <div className="pt-2">
            <Boton
              type="submit"
              ancho
              tamano="grande"
              cargando={isSaving}
              disabled={!nuevoTitulo.trim()}
            >
              Crear con checklist
            </Boton>
          </div>
        </form>
      </Hoja>
    </Pantalla>
  );
}

const TONO_ESTADO: Record<
  EventoEstado,
  "neutro" | "info" | "exito" | "peligro"
> = {
  borrador: "neutro",
  confirmado: "info",
  completado: "exito",
  cancelado: "peligro",
};

const OPCIONES_CATEGORIA: OpcionSelector<EventoChecklistCategoria>[] =
  EVENTO_CHECKLIST_CATEGORIAS.map((cat) => ({
    valor: cat,
    label: ETIQUETA_CHECKLIST_CATEGORIA[cat],
  }));

function ListaEventos(props: {
  titulo: string;
  eventos: Evento[];
  onAbrir: (id: string) => void;
  atenuado?: boolean;
}) {
  const { titulo, eventos, onAbrir, atenuado } = props;
  return (
    <Seccion
      titulo={`${titulo} · ${eventos.length}`}
      className={atenuado ? "opacity-70" : undefined}
    >
      <Lista>
        {eventos.map((evento) => (
          <Fila
            key={evento.id}
            titulo={evento.titulo}
            detalle={[
              `${etiquetaFechaCorta(evento.fecha)}${evento.hora ? ` · ${evento.hora.slice(0, 5)}` : ""}`,
              evento.lugar,
              evento.comensales ? `${evento.comensales} pax` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            valor={
              <Etiqueta tono={TONO_ESTADO[evento.estado]}>
                {ETIQUETA_EVENTO_ESTADO[evento.estado]}
              </Etiqueta>
            }
            onClick={() => void onAbrir(evento.id)}
          />
        ))}
      </Lista>
    </Seccion>
  );
}

/**
 * Fila de la checklist pensada para armar la valija con una mano: toda la fila
 * es el tilde de «en la valija»; a la derecha, «Listo» y el menú de edición.
 */
function FilaChecklist(props: {
  item: EventoChecklistItem;
  onValija: () => void;
  onListo: () => void;
  onEditar: () => void;
}) {
  const { item, onValija, onListo, onEditar } = props;
  return (
    <li
      className={cx(
        "flex items-center border-b border-separator transition-colors duration-200 last:border-0",
        item.enValija && "bg-success-soft",
      )}
    >
      <button
        type="button"
        aria-pressed={item.enValija}
        aria-label={`${item.titulo}, ${item.cantidad} ${item.unidad}: ${item.enValija ? "sacar de la valija" : "marcar en la valija"}`}
        onClick={() => {
          vibrar(item.enValija ? "toque" : "exito");
          onValija();
        }}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-2 text-left transition active:bg-fill"
      >
        <span
          className={cx(
            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
            item.enValija
              ? "scale-100 border-success bg-success text-[#fff]"
              : "border-label-3/60 text-transparent",
          )}
        >
          <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              "block text-[1rem] leading-snug",
              item.enValija ? "text-label-2 line-through" : "text-label",
            )}
          >
            {item.titulo}
          </span>
          <span className="mt-0.5 block text-[0.84rem] leading-snug text-label-3">
            <span className="font-semibold tabular-nums text-label-2">
              {item.cantidad}
            </span>{" "}
            {item.unidad}
            {item.completado ? (
              <span className="text-info">
                {" "}
                · Listo
                {item.completadoPorNombre
                  ? ` · ${item.completadoPorNombre}`
                  : ""}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-pressed={item.completado}
        aria-label={`${item.titulo}: ${item.completado ? "marcar no listo" : "marcar listo"}`}
        onClick={() => {
          vibrar();
          onListo();
        }}
        className={cx(
          "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.8rem] font-semibold transition active:scale-95",
          item.completado ? "bg-info-soft text-info" : "bg-fill text-label-3",
        )}
      >
        {item.completado ? (
          <CircleCheck className="h-4 w-4" aria-hidden />
        ) : (
          <Circle className="h-4 w-4" aria-hidden />
        )}
        Listo
      </button>
      <BotonIcono
        etiqueta={`Editar ${item.titulo}`}
        variante="plano"
        icono={<Ellipsis className="h-5 w-5" aria-hidden />}
        onClick={onEditar}
        className="mx-0.5"
      />
    </li>
  );
}

/** Hoja para corregir un ítem de la checklist (nombre, cantidad, unidad, categoría). */
function HojaItemChecklist(props: {
  item: EventoChecklistItem;
  onCerrar: () => void;
  onTitulo: (raw: string) => void;
  onCantidad: (raw: string) => void;
  onUnidad: (unidad: string) => void;
  onCategoria: (categoria: EventoChecklistCategoria) => void;
  onValija: () => void;
  onEliminar: () => void;
}) {
  const {
    item,
    onCerrar,
    onTitulo,
    onCantidad,
    onUnidad,
    onCategoria,
    onValija,
    onEliminar,
  } = props;
  const [titulo, setTitulo] = useState(item.titulo);
  const [cantidad, setCantidad] = useState(String(item.cantidad));

  const normalizarCantidad = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  };

  const guardarTitulo = () => {
    const limpio = titulo.trim();
    if (!limpio) {
      setTitulo(item.titulo);
      return;
    }
    if (limpio !== item.titulo) onTitulo(limpio);
  };

  const guardarCantidad = (raw: string) => {
    const n = normalizarCantidad(raw);
    setCantidad(String(n));
    if (n !== item.cantidad) onCantidad(String(n));
  };

  // Lo pendiente se guarda al cerrar; la función de cierre queda estable
  // (ver comentario en EventosPage) y lee el último estado desde una ref.
  const alCerrar = useRef<() => void>(() => {});
  useEffect(() => {
    alCerrar.current = () => {
      if (!item.enValija) {
        guardarTitulo();
        guardarCantidad(cantidad);
      }
      onCerrar();
    };
  });
  const cerrar = useCallback(() => alCerrar.current(), []);

  const opcionesUnidad: OpcionSelector<string>[] = [
    ...(EVENTO_CHECKLIST_UNIDADES.includes(
      item.unidad as (typeof EVENTO_CHECKLIST_UNIDADES)[number],
    )
      ? []
      : [{ valor: item.unidad, label: item.unidad }]),
    ...EVENTO_CHECKLIST_UNIDADES.map((u) => ({ valor: u as string, label: u })),
  ];

  return (
    <Hoja abierta onCerrar={cerrar} titulo={item.titulo}>
      <div className="space-y-3 pb-2">
        {item.enValija ? (
          <div className="rounded-card bg-success-soft px-4 py-3">
            <p className="text-[0.94rem] text-label">
              <span className="font-semibold tabular-nums">
                {item.cantidad}
              </span>{" "}
              {item.unidad} · {ETIQUETA_CHECKLIST_CATEGORIA[item.categoria]}
            </p>
            <p className="mt-1 text-[0.9rem] text-success">
              Está en la valija. Sacalo para editarlo.
            </p>
            <div className="mt-3">
              <Boton
                variante="secundario"
                ancho
                icono={<Luggage className="h-[18px] w-[18px]" aria-hidden />}
                onClick={onValija}
              >
                Sacar de la valija
              </Boton>
            </div>
          </div>
        ) : (
          <>
            <Campo
              label="Nombre"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={guardarTitulo}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              enterKeyHint="done"
              error={
                titulo.trim() ? undefined : "El nombre no puede quedar vacío."
              }
            />
            <div>
              <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
                Cantidad
              </p>
              <div className="flex items-center gap-2">
                <BotonIcono
                  etiqueta="Restar 1"
                  icono={<Minus className="h-5 w-5" aria-hidden />}
                  disabled={normalizarCantidad(cantidad) <= 1}
                  onClick={() =>
                    guardarCantidad(String(normalizarCantidad(cantidad) - 1))
                  }
                  className="size-12"
                />
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label={`Cantidad de ${item.titulo}`}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  onBlur={(e) => guardarCantidad(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-12 w-0 min-w-0 flex-1 rounded-control bg-fill px-3 text-center font-mono text-[1.1rem] tabular-nums text-label outline-none ring-accent/60 focus:bg-surface-3 focus:ring-2"
                />
                <BotonIcono
                  etiqueta="Sumar 1"
                  icono={<Plus className="h-5 w-5" aria-hidden />}
                  onClick={() =>
                    guardarCantidad(String(normalizarCantidad(cantidad) + 1))
                  }
                  className="size-12"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Selector
                label="Unidad"
                valor={item.unidad}
                opciones={opcionesUnidad}
                onChange={onUnidad}
              />
              <Selector
                label="Categoría"
                valor={item.categoria}
                opciones={OPCIONES_CATEGORIA}
                onChange={onCategoria}
              />
            </div>
          </>
        )}
        <div className="pt-2">
          <Boton
            ancho
            variante="peligro"
            icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
            onClick={onEliminar}
          >
            Eliminar de la checklist
          </Boton>
        </div>
      </div>
    </Hoja>
  );
}
