"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { EventoMenuOmakase } from "@/app/components/evento-menu-omakase";
import {
  actualizarEvento,
  actualizarCantidadChecklistItem,
  contarPasosMenu,
  crearEvento,
  crearEventoChecklistItem,
  crearEventoMenuItem,
  eliminarEvento,
  eliminarEventoChecklistItem,
  eliminarEventoMenuItem,
  ETIQUETA_EVENTO_ESTADO,
  EVENTO_ESTADOS,
  extrasDesdeMenuItems,
  fetchEventoDetalle,
  fetchEventos,
  guardarMenuOmakaseEvento,
  progresoChecklist,
  slotsDesdeMenuItems,
  slotsVaciosMenuOmakase,
  sincronizarChecklistDesdeMenu,
  toggleEventoChecklistItem,
  type Evento,
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
    d.getDate()
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
  const [success, setSuccess] = useState<string | null>(null);

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoFecha, setNuevoFecha] = useState(() => formatFechaLocalYYYYMMDD(now));
  const [nuevoHora, setNuevoHora] = useState(() => horaLocalHHmm(now));
  const [nuevoLugar, setNuevoLugar] = useState("");
  const [nuevoComensales, setNuevoComensales] = useState("");

  const [platoSeleccionado, setPlatoSeleccionado] = useState("");
  const [menuLibre, setMenuLibre] = useState("");
  const [checklistNuevo, setChecklistNuevo] = useState("");
  const [checklistCantidadNueva, setChecklistCantidadNueva] = useState("1");
  const [menuSlots, setMenuSlots] = useState<EventoMenuOmakaseSlots>(() =>
    slotsVaciosMenuOmakase()
  );

  const eventosProximos = useMemo(() => {
    const hoy = formatFechaLocalYYYYMMDD(new Date());
    const activos = eventos.filter((e) => e.estado !== "cancelado" && e.estado !== "completado");
    const futuros = activos.filter((e) => e.fecha >= hoy);
    const pasados = activos.filter((e) => e.fecha < hoy);
    const cerrados = eventos.filter((e) => e.estado === "completado" || e.estado === "cancelado");
    return { futuros, pasados, cerrados };
  }, [eventos]);

  const platosPorId = useMemo(
    () => new Map(platos.map((p) => [p.id, p])),
    [platos]
  );

  const extrasMenu = useMemo(
    () => (detalle ? extrasDesdeMenuItems(detalle.menuItems) : []),
    [detalle]
  );

  const progreso = useMemo(
    () => (detalle ? progresoChecklist(detalle.checklistItems) : { total: 0, listos: 0 }),
    [detalle]
  );

  const cargarLista = useCallback(async () => {
    setEventos(await fetchEventos());
  }, []);

  const cargarDetalle = useCallback(async (id: string) => {
    const data = await fetchEventoDetalle(id);
    setDetalle(data);
    if (data) {
      setMenuSlots(slotsDesdeMenuItems(data.menuItems));
    } else {
      setMenuSlots(slotsVaciosMenuOmakase());
    }
    return data;
  }, []);

  const cargarDatos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [lista, platosRes] = await Promise.all([
        fetchEventos(),
        supabase.from("platos").select("id, nombre, categoria").order("categoria").order("nombre"),
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
    setSuccess(null);
    setMostrarNuevo(false);
    try {
      await cargarDetalle(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el evento.");
    }
  };

  const volverALista = () => {
    setDetalle(null);
    setMenuSlots(slotsVaciosMenuOmakase());
    setError(null);
    setSuccess(null);
    void cargarLista();
  };

  const crearNuevoEvento = async (event: FormEvent) => {
    event.preventDefault();
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);
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
      setSuccess("Evento creado. Armá el menú Omakase abajo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el evento.");
    } finally {
      setIsSaving(false);
    }
  };

  const guardarCabecera = async () => {
    if (!detalle) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
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
      setSuccess("Evento actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const borrarEvento = async () => {
    if (!detalle) return;
    const ok = window.confirm(`¿Eliminar "${detalle.titulo}"?`);
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
    setSuccess(null);
    try {
      const menuItems = await guardarMenuOmakaseEvento(
        detalle.id,
        menuSlots,
        platosPorId
      );
      const { checklist, agregados } = await sincronizarChecklistDesdeMenu(detalle.id);
      setDetalle((prev) =>
        prev ? { ...prev, menuItems, checklistItems: checklist } : prev
      );
      setSuccess(
        `Menú guardado: ${conteo.base}/${conteo.baseObjetivo} base` +
          (!menuSlots.nigiriOnly && conteo.regalo > 0
            ? ` + ${conteo.regalo} regalo`
            : "") +
          (agregados > 0 ? ` · checklist +${agregados} insumos` : "") +
          "."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el menú.");
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
        prev ? { ...prev, menuItems: [...prev.menuItems, item] } : prev
      );
      setPlatoSeleccionado("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar extra.");
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
        prev ? { ...prev, menuItems: [...prev.menuItems, item] } : prev
      );
      setMenuLibre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar al menú.");
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
          ? { ...prev, menuItems: prev.menuItems.filter((m) => m.id !== item.id) }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar del menú.");
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
      });
      setDetalle((prev) =>
        prev ? { ...prev, checklistItems: [...prev.checklistItems, item] } : prev
      );
      setChecklistNuevo("");
      setChecklistCantidadNueva("1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar ítem.");
    } finally {
      setIsSaving(false);
    }
  };

  const cambiarCantidadChecklist = async (itemId: string, raw: string) => {
    if (!detalle) return;
    const parsed = Number(raw);
    const cantidad = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((i) =>
              i.id === itemId ? { ...i, cantidad } : i
            ),
          }
        : prev
    );
    try {
      const actualizado = await actualizarCantidadChecklistItem(itemId, cantidad);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i
              ),
            }
          : prev
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar la cantidad."
      );
    }
  };

  const sincronizarChecklist = async () => {
    if (!detalle) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { checklist, agregados } = await sincronizarChecklistDesdeMenu(detalle.id);
      setDetalle((prev) => (prev ? { ...prev, checklistItems: checklist } : prev));
      setSuccess(
        agregados > 0
          ? `Checklist actualizada: +${agregados} insumos desde el menú.`
          : "Checklist al día: no había insumos nuevos."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo sincronizar la checklist."
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
      const actualizado = await toggleEventoChecklistItem(item, !item.completado);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              checklistItems: prev.checklistItems.map((i) =>
                i.id === itemId ? actualizado : i
              ),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  };

  const quitarChecklist = async (id: string) => {
    if (!detalle) return;
    setError(null);
    try {
      await eliminarEventoChecklistItem(id);
      setDetalle((prev) =>
        prev
          ? { ...prev, checklistItems: prev.checklistItems.filter((i) => i.id !== id) }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  if (detalle) {
    return (
      <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={volverALista}
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Todos los eventos
          </button>

          {error ? (
            <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              {success}
            </p>
          ) : null}

          <header className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Título
                </span>
                <input
                  value={detalle.titulo}
                  onChange={(e) =>
                    setDetalle((prev) => (prev ? { ...prev, titulo: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Fecha
                </span>
                <input
                  type="date"
                  value={detalle.fecha}
                  onChange={(e) =>
                    setDetalle((prev) => (prev ? { ...prev, fecha: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Hora
                </span>
                <input
                  type="time"
                  value={detalle.hora ?? ""}
                  onChange={(e) =>
                    setDetalle((prev) =>
                      prev ? { ...prev, hora: e.target.value || null } : prev
                    )
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Lugar
                </span>
                <input
                  value={detalle.lugar ?? ""}
                  onChange={(e) =>
                    setDetalle((prev) =>
                      prev ? { ...prev, lugar: e.target.value || null } : prev
                    )
                  }
                  placeholder="Domicilio, salón, etc."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Comensales
                </span>
                <input
                  type="number"
                  min={1}
                  value={detalle.comensales ?? ""}
                  onChange={(e) =>
                    setDetalle((prev) =>
                      prev
                        ? {
                            ...prev,
                            comensales: e.target.value ? Number(e.target.value) : null,
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Estado
                </span>
                <select
                  value={detalle.estado}
                  onChange={(e) =>
                    setDetalle((prev) =>
                      prev ? { ...prev, estado: e.target.value as EventoEstado } : prev
                    )
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                >
                  {EVENTO_ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {ETIQUETA_EVENTO_ESTADO[estado]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Notas
                </span>
                <textarea
                  value={detalle.notas ?? ""}
                  onChange={(e) =>
                    setDetalle((prev) =>
                      prev ? { ...prev, notas: e.target.value || null } : prev
                    )
                  }
                  rows={2}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void guardarCabecera()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => void borrarEvento()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-red-900/50 px-4 py-2 text-sm text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          </header>

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

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Qué llevar / checklist
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {progreso.listos} de {progreso.total} listos · equipo + insumos del menú
                  (sin duplicar)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {progreso.total > 0 ? (
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${(progreso.listos / Math.max(progreso.total, 1)) * 100}%`,
                      }}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void sincronizarChecklist()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 border border-zinc-600 bg-zinc-950 px-3 py-2 text-[11px] font-medium text-zinc-200 disabled:opacity-40"
                  title="Suma insumos únicos de los platos del menú"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Desde menú
                </button>
              </div>
            </div>

            <ul className="mb-4 space-y-2">
              {detalle.checklistItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                    item.completado
                      ? "border-emerald-900/40 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void toggleChecklist(item.id)}
                    className="mt-0.5 shrink-0 text-emerald-400"
                    aria-label={item.completado ? "Marcar pendiente" : "Marcar listo"}
                  >
                    {item.completado ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5 text-zinc-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        item.completado ? "text-zinc-400 line-through" : "text-zinc-100"
                      }`}
                    >
                      {item.titulo}
                    </p>
                    {item.completado && item.completadoPorNombre ? (
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {item.completadoPorNombre}
                      </p>
                    ) : null}
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      ud
                    </span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={item.cantidad}
                      onChange={(e) => void cambiarCantidadChecklist(item.id, e.target.value)}
                      disabled={item.completado}
                      className="w-14 border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-sm tabular-nums text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                      aria-label={`Cantidad de ${item.titulo}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void quitarChecklist(item.id)}
                    className="shrink-0 rounded-lg p-1 text-zinc-600 hover:text-red-400"
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={checklistCantidadNueva}
                onChange={(e) => setChecklistCantidadNueva(e.target.value)}
                className="w-16 border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm tabular-nums outline-none focus:border-zinc-500"
                aria-label="Cantidad del nuevo ítem"
                title="Cantidad"
              />
              <input
                value={checklistNuevo}
                onChange={(e) => setChecklistNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void agregarChecklist();
                  }
                }}
                placeholder="Agregar ítem a la checklist…"
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() => void agregarChecklist()}
                disabled={isSaving || !checklistNuevo.trim()}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-600 px-3 py-2 text-sm disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Eventos</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Menú propio y checklist de qué llevar para cada evento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMostrarNuevo((v) => !v);
              setError(null);
              setSuccess(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            <Plus className="h-4 w-4" />
            Nuevo evento
          </button>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {mostrarNuevo ? (
          <form
            onSubmit={crearNuevoEvento}
            className="mb-6 space-y-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4"
          >
            <h2 className="text-sm font-medium text-zinc-200">Nuevo evento</h2>
            <input
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              placeholder="Título (ej. Cena privada García)"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-zinc-500"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={nuevoFecha}
                onChange={(e) => setNuevoFecha(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
              />
              <input
                type="time"
                value={nuevoHora}
                onChange={(e) => setNuevoHora(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
              />
            </div>
            <input
              value={nuevoLugar}
              onChange={(e) => setNuevoLugar(e.target.value)}
              placeholder="Lugar (opcional)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
            />
            <input
              type="number"
              min={1}
              value={nuevoComensales}
              onChange={(e) => setNuevoComensales(e.target.value)}
              placeholder="Comensales (opcional)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={isSaving || !nuevoTitulo.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crear con checklist
            </button>
          </form>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando eventos…
          </div>
        ) : eventos.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No hay eventos. Creá el primero con el botón de arriba.
          </p>
        ) : (
          <div className="space-y-6">
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
                titulo="Completados / cancelados"
                eventos={eventosProximos.cerrados}
                onAbrir={abrirEvento}
                atenuado
              />
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function ListaEventos(props: {
  titulo: string;
  eventos: Evento[];
  onAbrir: (id: string) => void;
  atenuado?: boolean;
}) {
  const { titulo, eventos, onAbrir, atenuado } = props;
  return (
    <div className={atenuado ? "opacity-60" : ""}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {titulo}
      </h2>
      <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
        {eventos.map((evento) => (
          <li key={evento.id}>
            <button
              type="button"
              onClick={() => void onAbrir(evento.id)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/80"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">{evento.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {etiquetaFechaCorta(evento.fecha)}
                    {evento.hora ? ` · ${evento.hora}` : ""}
                  </span>
                  {evento.lugar ? <span>{evento.lugar}</span> : null}
                  {evento.comensales ? <span>{evento.comensales} pax</span> : null}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                {ETIQUETA_EVENTO_ESTADO[evento.estado]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
