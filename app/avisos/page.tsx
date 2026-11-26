"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  crearAviso,
  fetchAvisosPendientes,
  marcarAvisoResuelto,
  reabrirAviso,
  type PedidoAviso,
} from "@/src/lib/pedido-avisos";
import {
  crearStockItem,
  fetchStockItems,
  normalizarNombreClave,
  type StockItem,
} from "@/src/lib/stock-items";
import {
  RUBROS_INGREDIENTE,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import {
  PROVEEDORES,
  UNIDADES,
  crearProveedor,
  fetchProveedores,
  ordenarProveedores,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import { supabase } from "@/src/lib/supabase";
import {
  Boton,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Lista,
  Pantalla,
  Seccion,
  Selector,
  useAvisos,
  vibrar,
  type OpcionSelector,
} from "@/app/ui";

const PROVEEDOR_NUEVO = "__nuevo__";

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

/** Fecha y hora absolutas de cuándo se cargó el aviso (ej. "sáb 4 jul, 18:25"). */
function fechaHoraCarga(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AvisosPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [avisos, setAvisos] = useState<PedidoAviso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proveedores, setProveedores] = useState<Proveedor[]>([...PROVEEDORES]);
  const [query, setQuery] = useState("");
  const [itemSeleccionado, setItemSeleccionado] = useState<StockItem | null>(
    null,
  );
  const [nota, setNota] = useState("");
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [creandoItem, setCreandoItem] = useState(false);
  const [nuevoProveedorModo, setNuevoProveedorModo] = useState(false);
  const [proveedorElegido, setProveedorElegido] = useState("");
  const [proveedorNuevoNombre, setProveedorNuevoNombre] = useState("");
  const [unidadNueva, setUnidadNueva] = useState<UnidadMedida>("Unidad");
  const [rubroNuevo, setRubroNuevo] =
    useState<RubroIngrediente>("Despensa/Prep");

  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<SnapshotResuelto | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const { aviso: mostrarAviso, confirmar } = useAvisos();

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, avisosData, proveedoresData] = await Promise.all([
        fetchStockItems(),
        fetchAvisosPendientes(),
        fetchProveedores(),
      ]);
      setItems(itemsData.filter((it) => it.activo));
      setAvisos(avisosData);
      setProveedores(proveedoresData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
      );
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
    return items
      .filter((it) => normalizarNombreClave(it.nombre).includes(clave))
      .slice(0, 8);
  }, [items, query, itemSeleccionado]);

  const coincideExacto = useMemo(() => {
    const clave = normalizarNombreClave(query);
    if (!clave) return null;
    return (
      items.find((it) => normalizarNombreClave(it.nombre) === clave) ?? null
    );
  }, [items, query]);

  const seleccionarItem = (item: StockItem) => {
    setItemSeleccionado(item);
    setQuery(item.nombre);
    setDropdownAbierto(false);
    setAvisoDuplicado(null);
    setCreandoItem(false);
    setNuevoProveedorModo(false);
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
    setCreandoItem(false);
    setNuevoProveedorModo(false);
    setProveedorElegido("");
    setProveedorNuevoNombre("");
    setUnidadNueva("Unidad");
    setRubroNuevo("Despensa/Prep");
  };

  const abrirCrearItem = () => {
    setCreandoItem(true);
    setItemSeleccionado(null);
    setDropdownAbierto(false);
    setAvisoDuplicado(null);
  };

  const agregarAviso = async () => {
    if (!itemSeleccionado) {
      return;
    }
    const yaPendiente = avisos.some(
      (a) => a.stockItemId === itemSeleccionado.id,
    );
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
      setError(
        err instanceof Error ? err.message : "No se pudo agregar el aviso.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const crearItemYAviso = async () => {
    const nombre = query.trim().replace(/\s+/g, " ");
    if (!nombre) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let proveedor: Proveedor | null = proveedorElegido.trim() || null;
      if (nuevoProveedorModo || proveedorElegido === PROVEEDOR_NUEVO) {
        const creado = await crearProveedor(proveedorNuevoNombre);
        proveedor = creado;
        setProveedores((prev) => ordenarProveedores([...prev, creado]));
      }
      const item = await crearStockItem({
        nombre,
        rubro: rubroNuevo,
        proveedor,
        unidadCompra: unidadNueva,
      });
      setItems((prev) =>
        [...prev, item].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      );
      const nuevo = await crearAviso(item.id, nota);
      setAvisos((prev) => [...prev, nuevo]);
      limpiarFormulario();
      inputRef.current?.focus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el ítem.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const reabrir = useCallback(async (aviso: PedidoAviso) => {
    setUndoSnapshot((current) =>
      current?.aviso.id === aviso.id ? null : current,
    );
    try {
      await reabrirAviso(aviso.id);
      setAvisos((prev) =>
        prev.some((a) => a.id === aviso.id) ? prev : [...prev, aviso],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer.");
    }
  }, []);

  const deshacerResuelto = useCallback(async () => {
    if (!undoSnapshot) {
      return;
    }
    await reabrir(undoSnapshot.aviso);
  }, [undoSnapshot, reabrir]);

  useEffect(() => {
    if (!undoSnapshot) {
      return;
    }
    const snap = undoSnapshot;
    const timer = window.setTimeout(() => {
      setUndoSnapshot((current) =>
        current?.aviso.id === snap.aviso.id ? null : current,
      );
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
      mostrarAviso(`${aviso.nombre}: pedido`, {
        tono: "exito",
        ms: UNDO_MS,
        deshacer: () => void reabrir(aviso),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo marcar como pedido.",
      );
    } finally {
      setResolviendoId(null);
    }
  };

  const borrarAviso = async (aviso: PedidoAviso) => {
    const ok = await confirmar({
      titulo: `¿Borrar el aviso de «${aviso.nombre}»?`,
      texto: "Usalo si se cargó sin querer. Si ya se pidió, tocá Pedido.",
      confirmar: "Borrar aviso",
      peligro: true,
    });
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
      setError(
        err instanceof Error ? err.message : "No se pudo borrar el aviso.",
      );
    } finally {
      setResolviendoId(null);
    }
  };

  const gruposPorProveedor = useMemo(() => {
    const extras = avisos
      .map((a) => a.proveedor)
      .filter((p): p is Proveedor => Boolean(p));
    const orden: (Proveedor | "Sin proveedor")[] = [
      ...ordenarProveedores([...proveedores, ...extras]),
      "Sin proveedor",
    ];
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
  }, [avisos, proveedores]);

  const opcionesProveedor: OpcionSelector<string>[] = [
    { valor: "", label: "Sin proveedor" },
    ...proveedores.map((p) => ({ valor: p, label: p })),
    { valor: PROVEEDOR_NUEVO, label: "Nuevo proveedor…" },
  ];

  const mostrarSugerencias =
    dropdownAbierto && !creandoItem && (sugerencias.length > 0 || query.trim());

  return (
    <Pantalla
      titulo="Avisos"
      subtitulo={
        isLoading
          ? "Cargando…"
          : avisos.length === 0
            ? "Nada pendiente de pedir"
            : `${avisos.length} ${avisos.length === 1 ? "ítem" : "ítems"} para pedir`
      }
      ayuda={
        <>
          <p>
            Cuando algo se está por acabar, buscalo y cargalo acá: queda en la
            lista para que alguien lo pida.
          </p>
          <p>
            Si el ítem o el proveedor no existen, se crean desde el mismo
            buscador con <strong className="text-label">Crear «…»</strong>.
          </p>
          <p>
            Quien hace el pedido toca{" "}
            <strong className="text-label">Pedido</strong> (se puede deshacer).
            Para borrar un aviso cargado sin querer, deslizá la fila hacia la
            izquierda.
          </p>
        </>
      }
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      <div className="rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-3"
            aria-hidden
          />
          <input
            ref={inputRef}
            id="avisos-buscar"
            type="search"
            enterKeyHint="search"
            aria-label="Qué se está acabando"
            value={query}
            onChange={(e) => onCambiarQuery(e.target.value)}
            onFocus={() => setDropdownAbierto(true)}
            onBlur={() =>
              window.setTimeout(() => setDropdownAbierto(false), 150)
            }
            placeholder="¿Qué se está acabando?"
            autoComplete="off"
            className="min-h-12 w-full rounded-control bg-fill pl-10 pr-3.5 text-[1rem] text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2"
          />
          {mostrarSugerencias ? (
            <ul className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-card bg-surface-2 shadow-[0_12px_32px_rgb(0_0_0/0.22)] ring-1 ring-separator">
              {sugerencias.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-separator last:border-0"
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => seleccionarItem(item)}
                    className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left text-[1rem] text-label transition active:bg-fill"
                  >
                    <span className="truncate">{item.nombre}</span>
                    <Etiqueta>{item.proveedor ?? "Sin proveedor"}</Etiqueta>
                  </button>
                </li>
              ))}
              {query.trim() && !coincideExacto ? (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={abrirCrearItem}
                    className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[1rem] font-semibold text-accent transition active:bg-fill"
                  >
                    <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    Crear «{query.trim()}»
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {creandoItem ? (
          <div className="mt-3 space-y-3 border-t border-separator pt-3">
            <p className="px-1 text-[0.9rem] text-label-2">
              Ítem nuevo:{" "}
              <strong className="text-label">{query.trim() || "—"}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selector
                label="Proveedor"
                valor={nuevoProveedorModo ? PROVEEDOR_NUEVO : proveedorElegido}
                opciones={opcionesProveedor}
                buscar={opcionesProveedor.length > 10}
                onChange={(v) => {
                  if (v === PROVEEDOR_NUEVO) {
                    setNuevoProveedorModo(true);
                    setProveedorElegido(PROVEEDOR_NUEVO);
                  } else {
                    setNuevoProveedorModo(false);
                    setProveedorElegido(v);
                  }
                }}
              />
              <Selector
                label="Unidad"
                valor={unidadNueva}
                opciones={UNIDADES.map((u) => ({ valor: u, label: u }))}
                onChange={(v) => setUnidadNueva(v as UnidadMedida)}
              />
            </div>
            {nuevoProveedorModo ? (
              <Campo
                label="Nombre del proveedor"
                value={proveedorNuevoNombre}
                onChange={(e) => setProveedorNuevoNombre(e.target.value)}
                placeholder="Ej. Salvioni y Alomar"
              />
            ) : null}
            <Selector
              label="Rubro"
              valor={rubroNuevo}
              opciones={RUBROS_INGREDIENTE.map((r) => ({ valor: r, label: r }))}
              onChange={(v) => setRubroNuevo(v as RubroIngrediente)}
            />
            <Campo
              label="Nota (opcional)"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Casi no queda, para el finde…"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Boton
                cargando={isSubmitting}
                disabled={
                  !query.trim() ||
                  (nuevoProveedorModo && !proveedorNuevoNombre.trim())
                }
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void crearItemYAviso()}
              >
                Crear y avisar
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => {
                  setCreandoItem(false);
                  setNuevoProveedorModo(false);
                  setProveedorElegido("");
                  setProveedorNuevoNombre("");
                }}
              >
                Cancelar
              </Boton>
            </div>
          </div>
        ) : itemSeleccionado ? (
          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2 border-t border-separator pt-3">
            <Campo
              aria-label="Nota (opcional)"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (opcional)"
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void agregarAviso();
                }
              }}
            />
            <Boton
              cargando={isSubmitting}
              icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => void agregarAviso()}
              className="min-h-12"
            >
              Avisar
            </Boton>
          </div>
        ) : null}

        {avisoDuplicado ? (
          <p className="mt-2 px-1 text-[0.86rem] text-warning">
            «{avisoDuplicado}» ya está en la lista.
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6">
          <EsqueletoLista filas={5} />
        </div>
      ) : avisos.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface-3">
          <EstadoVacio
            icono={<CircleCheck className="h-6 w-6" aria-hidden />}
            titulo="Nada pendiente de pedir"
            texto="Cuando algo se esté por acabar, buscalo arriba y queda acá para que alguien lo pida."
          />
        </div>
      ) : (
        gruposPorProveedor.map(({ proveedor, avisos: avisosGrupo }) => (
          <Seccion
            key={proveedor}
            titulo={`${proveedor} · ${avisosGrupo.length}`}
          >
            <Lista>
              {avisosGrupo.map((aviso) => {
                const busy = resolviendoId === aviso.id;
                return (
                  <Fila
                    key={aviso.id}
                    titulo={<span className="font-medium">{aviso.nombre}</span>}
                    detalle={
                      <>
                        {aviso.nota ? (
                          <span className="text-label-2">{aviso.nota} · </span>
                        ) : null}
                        {tiempoDesde(aviso.createdAt)}
                        <span className="sr-only">
                          {" "}
                          ({fechaHoraCarga(aviso.createdAt)})
                        </span>
                      </>
                    }
                    chevron={false}
                    valor={
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          vibrar();
                          void marcarPedido(aviso);
                        }}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-success-soft px-3.5 text-[0.88rem] font-semibold text-success transition active:scale-95 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        Pedido
                      </button>
                    }
                    acciones={[
                      {
                        label: "Borrar",
                        tono: "peligro",
                        icono: <Trash2 className="h-5 w-5" aria-hidden />,
                        onClick: () => void borrarAviso(aviso),
                      },
                    ]}
                  />
                );
              })}
            </Lista>
          </Seccion>
        ))
      )}
    </Pantalla>
  );
}
