"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import {
  crearAviso,
  fetchAvisosPendientes,
  marcarAvisoResuelto,
  reabrirAviso,
  type PedidoAviso,
} from "@/src/lib/pedido-avisos";
import {
  fetchStockItems,
  normalizarNombreClave,
  type StockItem,
} from "@/src/lib/stock-items";
import { PROVEEDORES, type Proveedor } from "@/src/lib/proveedores";
import { supabase } from "@/src/lib/supabase";

const UNDO_MS = 8000;

type SnapshotResuelto = {
  aviso: PedidoAviso;
};

function tiempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

function ProveedorBadge(props: { proveedor: Proveedor | null }) {
  const { proveedor } = props;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      {proveedor ?? "Sin proveedor"}
    </span>
  );
}

export default function AvisosPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [avisos, setAvisos] = useState<PedidoAviso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [itemSeleccionado, setItemSeleccionado] = useState<StockItem | null>(null);
  const [nota, setNota] = useState("");
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<SnapshotResuelto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, avisosData] = await Promise.all([
        fetchStockItems(),
        fetchAvisosPendientes(),
      ]);
      setItems(itemsData.filter((it) => it.activo));
      setAvisos(avisosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  const sugerencias = useMemo(() => {
    if (itemSeleccionado || !query.trim()) {
      return [];
    }
    const clave = normalizarNombreClave(query);
    return items.filter((it) => normalizarNombreClave(it.nombre).includes(clave)).slice(0, 8);
  }, [items, query, itemSeleccionado]);

  const seleccionarItem = (item: StockItem) => {
    setItemSeleccionado(item);
    setQuery(item.nombre);
    setDropdownAbierto(false);
    setAvisoDuplicado(null);
  };

  const onCambiarQuery = (valor: string) => {
    setQuery(valor);
    setDropdownAbierto(true);
    if (itemSeleccionado && valor !== itemSeleccionado.nombre) {
      setItemSeleccionado(null);
    }
    setAvisoDuplicado(null);
  };

  const limpiarFormulario = () => {
    setQuery("");
    setItemSeleccionado(null);
    setNota("");
    setDropdownAbierto(false);
    setAvisoDuplicado(null);
  };

  const agregarAviso = async () => {
    if (!itemSeleccionado) {
      return;
    }
    const yaPendiente = avisos.some((a) => a.stockItemId === itemSeleccionado.id);
    if (yaPendiente) {
      setAvisoDuplicado(itemSeleccionado.nombre);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const nuevo = await crearAviso(itemSeleccionado.id, nota);
      setAvisos((prev) => [...prev, nuevo]);
      limpiarFormulario();
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el aviso.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deshacerResuelto = useCallback(async () => {
    if (!undoSnapshot) {
      return;
    }
    const { aviso } = undoSnapshot;
    setUndoSnapshot(null);
    try {
      await reabrirAviso(aviso.id);
      setAvisos((prev) =>
        prev.some((a) => a.id === aviso.id) ? prev : [...prev, aviso]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer.");
    }
  }, [undoSnapshot]);

  useEffect(() => {
    if (!undoSnapshot) {
      return;
    }
    const snap = undoSnapshot;
    const timer = window.setTimeout(() => {
      setUndoSnapshot((current) => (current?.aviso.id === snap.aviso.id ? null : current));
    }, UNDO_MS);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      e.preventDefault();
      void deshacerResuelto();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [undoSnapshot, deshacerResuelto]);

  const marcarPedido = async (aviso: PedidoAviso) => {
    setResolviendoId(aviso.id);
    setError(null);
    try {
      await marcarAvisoResuelto(aviso.id);
      setAvisos((prev) => prev.filter((a) => a.id !== aviso.id));
      setUndoSnapshot({ aviso });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar como pedido.");
    } finally {
      setResolviendoId(null);
    }
  };

  const borrarAviso = async (aviso: PedidoAviso) => {
    const ok = window.confirm(`¿Borrar el aviso de "${aviso.nombre}"? (se cargó sin querer)`);
    if (!ok) {
      return;
    }
    setResolviendoId(aviso.id);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("pedido_avisos")
        .delete()
        .eq("id", aviso.id);
      if (deleteError) {
        throw deleteError;
      }
      setAvisos((prev) => prev.filter((a) => a.id !== aviso.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el aviso.");
    } finally {
      setResolviendoId(null);
    }
  };

  const gruposPorProveedor = useMemo(() => {
    const orden: (Proveedor | "Sin proveedor")[] = [...PROVEEDORES, "Sin proveedor"];
    const grupos = new Map<Proveedor | "Sin proveedor", PedidoAviso[]>();
    avisos.forEach((aviso) => {
      const clave = aviso.proveedor ?? "Sin proveedor";
      const lista = grupos.get(clave) ?? [];
      lista.push(aviso);
      grupos.set(clave, lista);
    });
    return orden
      .map((proveedor) => ({ proveedor, avisos: grupos.get(proveedor) ?? [] }))
      .filter((g) => g.avisos.length > 0);
  }, [avisos]);

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Bell className="h-5 w-5 text-amber-400" aria-hidden />
            Avisos de pedido
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cuando algo se está por acabar, cargalo acá. Queda en la lista para que alguien
            lo pida, y lo marca como <span className="text-zinc-300">Pedido</span> cuando lo
            haga.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <label htmlFor="avisos-buscar" className="mb-1 block text-xs font-medium text-zinc-500">
            Ítem
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              ref={inputRef}
              id="avisos-buscar"
              type="text"
              value={query}
              onChange={(e) => onCambiarQuery(e.target.value)}
              onFocus={() => setDropdownAbierto(true)}
              onBlur={() => window.setTimeout(() => setDropdownAbierto(false), 150)}
              placeholder="Buscá por nombre… (ej. Salmón, Botellitas)"
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
            {dropdownAbierto && sugerencias.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                {sugerencias.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => seleccionarItem(item)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                    >
                      <span className="truncate">{item.nombre}</span>
                      <ProveedorBadge proveedor={item.proveedor} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {itemSeleccionado ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs text-zinc-500 sm:flex-1">
                Nota (opcional)
                <input
                  type="text"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Casi no queda, para el finde…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void agregarAviso();
                    }
                  }}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
              </label>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void agregarAviso()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Agregar
              </button>
            </div>
          ) : null}

          {avisoDuplicado ? (
            <p className="mt-2 text-xs text-amber-300">
              &quot;{avisoDuplicado}&quot; ya está en la lista de avisos.
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : avisos.length === 0 ? (
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              No hay nada pendiente de pedir.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {gruposPorProveedor.map(({ proveedor, avisos: avisosGrupo }) => (
              <section key={proveedor}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {proveedor}
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-400">
                    {avisosGrupo.length}
                  </span>
                </h2>
                <ul className="overflow-hidden rounded-xl border border-zinc-800 divide-y divide-zinc-800/90">
                  {avisosGrupo.map((aviso) => {
                    const busy = resolviendoId === aviso.id;
                    return (
                      <li
                        key={aviso.id}
                        className="flex items-center gap-3 bg-zinc-950/40 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">{aviso.nombre}</p>
                          <p className="truncate text-xs text-zinc-500">
                            {aviso.nota ? `${aviso.nota} · ` : ""}
                            {tiempoDesde(aviso.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void borrarAviso(aviso)}
                          title="Borrar este aviso (se cargó sin querer)"
                          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent p-2 text-zinc-600 transition hover:border-zinc-700 hover:text-red-300 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void marcarPedido(aviso)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-700/80 bg-emerald-800/60 px-3 py-2 text-xs font-semibold text-emerald-50 transition active:scale-95 hover:bg-emerald-700/70 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                          )}
                          Pedido
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {undoSnapshot ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm sm:inset-x-6"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-zinc-200">
            <span className="font-medium text-white">{undoSnapshot.aviso.nombre}</span> marcado
            pedido
          </p>
          <button
            type="button"
            onClick={() => void deshacerResuelto()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Deshacer
            <kbd className="hidden rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">
              Z
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setUndoSnapshot(null)}
            aria-label="Cerrar"
            className="inline-flex shrink-0 items-center justify-center rounded-lg p-1 text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </main>
  );
}
