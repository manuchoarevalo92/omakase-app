"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Layers,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
  X,
} from "lucide-react";

import {
  agruparComprasPorStockItem,
  completarPrecio,
  fetchComprasHistorial,
  insertarComprasHistorial,
  ultimoPrecioUnitarioPorStockItem,
  type CompraHistorialRow,
} from "@/src/lib/compras-historial";
import {
  calcularPrediccionCompra,
  compararPorUrgencia,
  ESTADO_COMPRA_BADGE,
  type EstadoCompra,
  type PrediccionCompra,
} from "@/src/lib/compras-prediccion";
import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { parsearLineasMasivo, type LineaParseada } from "@/src/lib/parseo-lineas";
import {
  cambiosPrecioDesde,
  detectarCambiosPrecio,
  fechaHaceDias,
  formatearFechaCorta,
  formatearPrecioUnitario,
} from "@/src/lib/precio-alertas";
import {
  PROVEEDORES,
  UNIDADES,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import {
  buscarStockItemPorNombre,
  fetchStockItems,
  normalizarNombreClave,
  STOCK_ITEM_SELECT,
  stockItemDesdeFila,
  type StockItem,
  type StockItemDbRow,
} from "@/src/lib/stock-items";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

type ItemConPrediccion = {
  item: StockItem;
  prediccion: PrediccionCompra;
};

type PedidoItemDraft = {
  id: string;
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
};

type FilaHistorialEditable = {
  id: string;
  fecha: string;
  cantidad: string;
  unidad: UnidadMedida;
  precioUnitario: string;
  origen: CompraHistorialRow["origen"];
};

type SnapshotAccion =
  | {
      tipo: "pedido";
      proveedor: Proveedor;
      itemsAnteriores: PedidoItemDraft[];
      etiqueta: string;
    }
  | {
      tipo: "registro";
      compraId: string;
      etiqueta: string;
    };

const ESTADO_ICONO: Record<EstadoCompra, React.ReactNode> = {
  Atrasado: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  "Pedir pronto": <CalendarClock className="h-3.5 w-3.5" aria-hidden />,
  OK: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  "Sin datos": <HelpCircle className="h-3.5 w-3.5" aria-hidden />,
};

const ESTADOS_URGENTES: EstadoCompra[] = ["Atrasado", "Pedir pronto"];

function esUrgente(estado: EstadoCompra): boolean {
  return ESTADOS_URGENTES.includes(estado);
}

const SIN_PROVEEDOR = "Sin proveedor asignado";
const UNDO_AGREGADO_MS = 8000;
const STORAGE_SOLO_URGENTES = "omakase-compras-solo-urgentes";

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseCantidad(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizarBusqueda(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function leerSoloUrgentesGuardado(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_SOLO_URGENTES) === "1";
  } catch {
    return false;
  }
}

function KpiCard(props: {
  icono: React.ReactNode;
  titulo: string;
  valor: number;
  tono: string;
  activo?: boolean;
  onClick?: () => void;
}) {
  const { icono, titulo, valor, tono, activo, onClick } = props;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        activo
          ? "border-zinc-500 bg-zinc-900"
          : "border-zinc-800 bg-zinc-950/60"
      } ${onClick ? "hover:border-zinc-600" : ""}`}
    >
      <div className={`flex items-center gap-2 ${tono}`}>
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{titulo}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{valor}</p>
    </Comp>
  );
}

function EstadoBadge(props: { estado: EstadoCompra }) {
  const { estado } = props;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${ESTADO_COMPRA_BADGE[estado]}`}
    >
      {ESTADO_ICONO[estado]}
      {estado}
    </span>
  );
}

export default function ComprasPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [agregadoOkId, setAgregadoOkId] = useState<string | null>(null);
  const [agregandoLoteProveedor, setAgregandoLoteProveedor] = useState<string | null>(null);
  const [undoAccion, setUndoAccion] = useState<SnapshotAccion | null>(null);

  const [cantidadPorId, setCantidadPorId] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [soloUrgentes, setSoloUrgentes] = useState(() => leerSoloUrgentesGuardado());
  const [alDiaExpandido, setAlDiaExpandido] = useState(false);
  const [sinDatosExpandido, setSinDatosExpandido] = useState(true);
  const [cambiosPrecioExpandido, setCambiosPrecioExpandido] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(() => new Set());

  const [importAbierto, setImportAbierto] = useState(false);
  const [importProveedor, setImportProveedor] = useState<Proveedor | "">("");
  const [importFecha, setImportFecha] = useState(hoyISO());
  const [importUnidadDefault, setImportUnidadDefault] = useState<UnidadMedida>("Unidad");
  const [importTipoPrecio, setImportTipoPrecio] = useState<"unitario" | "total">("unitario");
  const [importTexto, setImportTexto] = useState("");
  const [importIsSaving, setImportIsSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [registrarItem, setRegistrarItem] = useState<StockItem | null>(null);
  const [registrarFecha, setRegistrarFecha] = useState(hoyISO());
  const [registrarCantidad, setRegistrarCantidad] = useState("");
  const [registrarPrecio, setRegistrarPrecio] = useState("");
  const [registrarTipoPrecio, setRegistrarTipoPrecio] = useState<"unitario" | "total">(
    "unitario"
  );
  const [registrarFrecuencia, setRegistrarFrecuencia] = useState("");
  const [registrarIsSaving, setRegistrarIsSaving] = useState(false);
  const [registrarError, setRegistrarError] = useState<string | null>(null);

  const [borrarItem, setBorrarItem] = useState<StockItem | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [borrarError, setBorrarError] = useState<string | null>(null);

  const [frecuenciaItem, setFrecuenciaItem] = useState<StockItem | null>(null);
  const [frecuenciaValor, setFrecuenciaValor] = useState("");
  const [frecuenciaIsSaving, setFrecuenciaIsSaving] = useState(false);
  const [frecuenciaError, setFrecuenciaError] = useState<string | null>(null);

  const [editarItem, setEditarItem] = useState<StockItem | null>(null);
  const [editarNombre, setEditarNombre] = useState("");
  const [editarProveedor, setEditarProveedor] = useState<Proveedor | "">("");
  const [editarRubro, setEditarRubro] = useState<RubroIngrediente>("Despensa/Prep");
  const [editarUnidad, setEditarUnidad] = useState<UnidadMedida>("Unidad");
  const [editarBuffer, setEditarBuffer] = useState("15");
  const [editarHistorial, setEditarHistorial] = useState<FilaHistorialEditable[]>([]);
  const [editarIsSaving, setEditarIsSaving] = useState(false);
  const [editarError, setEditarError] = useState<string | null>(null);
  const [editarBorrandoFilaId, setEditarBorrandoFilaId] = useState<string | null>(null);

  const buscadorRef = useRef<HTMLInputElement>(null);

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, historial] = await Promise.all([
        fetchStockItems(),
        fetchComprasHistorial(),
      ]);
      setStockItems(items);
      setCompras(historial);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_SOLO_URGENTES, soloUrgentes ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soloUrgentes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const comprasPorStockItem = useMemo(
    () => agruparComprasPorStockItem(compras),
    [compras]
  );

  const ultimoPrecioPorItem = useMemo(
    () => ultimoPrecioUnitarioPorStockItem(compras),
    [compras]
  );

  const itemsConPrediccion = useMemo(() => {
    return stockItems
      .filter((item) => item.activo)
      .map((item) => {
        const puntos = (comprasPorStockItem.get(item.id) ?? []).map((c) => ({
          fecha: c.fecha,
          cantidad: c.cantidad,
        }));
        const prediccion = calcularPrediccionCompra(
          puntos,
          item.bufferPct,
          item.intervaloEstimadoDias
        );
        return { item, prediccion };
      });
  }, [stockItems, comprasPorStockItem]);

  useEffect(() => {
    setCantidadPorId((prev) => {
      const next = { ...prev };
      itemsConPrediccion.forEach(({ item, prediccion }) => {
        if (next[item.id] === undefined && prediccion.cantidadSugerida != null) {
          next[item.id] = String(prediccion.cantidadSugerida);
        }
      });
      return next;
    });
  }, [itemsConPrediccion]);

  const kpis = useMemo(() => {
    const base = { Atrasado: 0, "Pedir pronto": 0, OK: 0, "Sin datos": 0 } as Record<
      EstadoCompra,
      number
    >;
    itemsConPrediccion.forEach(({ prediccion }) => {
      base[prediccion.estado] += 1;
    });
    return base;
  }, [itemsConPrediccion]);

  const cambiosPrecio = useMemo(() => detectarCambiosPrecio(compras), [compras]);

  const cambiosPrecioRecientes = useMemo(
    () => cambiosPrecioDesde(compras, fechaHaceDias(90)),
    [compras]
  );

  const subidasRecientes = useMemo(
    () => cambiosPrecioRecientes.filter((c) => c.variacionPct > 0).length,
    [cambiosPrecioRecientes]
  );

  const busquedaNormalizada = normalizarBusqueda(busqueda);

  const itemsFiltrados = useMemo(() => {
    if (!busquedaNormalizada) {
      return itemsConPrediccion;
    }
    return itemsConPrediccion.filter((entry) =>
      normalizarBusqueda(entry.item.nombre).includes(busquedaNormalizada)
    );
  }, [itemsConPrediccion, busquedaNormalizada]);

  const agruparPorProveedor = (
    lista: ItemConPrediccion[]
  ): [string, ItemConPrediccion[]][] => {
    const grupos = new Map<string, ItemConPrediccion[]>();
    lista.forEach((entry) => {
      const clave = entry.item.proveedor ?? SIN_PROVEEDOR;
      const l = grupos.get(clave) ?? [];
      l.push(entry);
      grupos.set(clave, l);
    });
    grupos.forEach((l) => {
      l.sort((a, b) => compararPorUrgencia(a.prediccion, b.prediccion));
    });
    const ordenados: [string, ItemConPrediccion[]][] = [];
    PROVEEDORES.forEach((p) => {
      const l = grupos.get(p);
      if (l && l.length > 0) {
        ordenados.push([p, l]);
      }
    });
    const sinProveedor = grupos.get(SIN_PROVEEDOR);
    if (sinProveedor && sinProveedor.length > 0) {
      ordenados.push([SIN_PROVEEDOR, sinProveedor]);
    }
    return ordenados;
  };

  const urgentesPorProveedor = useMemo(
    () => agruparPorProveedor(itemsFiltrados.filter((e) => esUrgente(e.prediccion.estado))),
    [itemsFiltrados]
  );
  const alDiaPorProveedor = useMemo(
    () => agruparPorProveedor(itemsFiltrados.filter((e) => e.prediccion.estado === "OK")),
    [itemsFiltrados]
  );
  const sinDatosPorProveedor = useMemo(
    () =>
      agruparPorProveedor(itemsFiltrados.filter((e) => e.prediccion.estado === "Sin datos")),
    [itemsFiltrados]
  );

  const totalUrgentes = kpis.Atrasado + kpis["Pedir pronto"];
  const hayBusqueda = busquedaNormalizada.length > 0;

  const toggleGrupo = (clave: string) => {
    setGruposColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) {
        next.delete(clave);
      } else {
        next.add(clave);
      }
      return next;
    });
  };

  const todoExpandido = alDiaExpandido && sinDatosExpandido && gruposColapsados.size === 0;
  const alternarExpandirTodo = () => {
    const nuevoValor = !todoExpandido;
    setAlDiaExpandido(nuevoValor);
    setSinDatosExpandido(nuevoValor);
    setGruposColapsados(new Set());
  };

  useEffect(() => {
    if (itemsConPrediccion.length === 0) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "u" || e.metaKey || e.ctrlKey || e.altKey) {
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
      setSoloUrgentes((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemsConPrediccion.length]);

  useEffect(() => {
    if (!undoAccion) {
      return;
    }
    const snap = undoAccion;
    const timer = window.setTimeout(() => {
      setUndoAccion((current) => (current === snap ? null : current));
    }, UNDO_AGREGADO_MS);

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
      void deshacerAccion();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoAccion]);

  const cambiosPrecioVisibles = soloUrgentes ? [] : cambiosPrecio;

  const importLineasPreview = useMemo(() => {
    if (!importAbierto) {
      return [] as (LineaParseada & { existente: StockItem | null })[];
    }
    return parsearLineasMasivo(importTexto, importUnidadDefault)
      .filter((l) => l.item.trim().length > 0)
      .map((l) => ({ ...l, existente: buscarStockItemPorNombre(l.item, stockItems) }));
  }, [importAbierto, importTexto, importUnidadDefault, stockItems]);

  const abrirImport = (proveedorPreseleccionado?: Proveedor) => {
    setImportProveedor(proveedorPreseleccionado ?? "");
    setImportFecha(hoyISO());
    setImportUnidadDefault("Unidad");
    setImportTipoPrecio("unitario");
    setImportTexto("");
    setImportError(null);
    setImportAbierto(true);
  };

  const cerrarImport = () => {
    setImportAbierto(false);
    setImportTexto("");
  };

  const confirmarImport = async () => {
    if (!importProveedor) {
      setImportError("Elegí el proveedor del albarán.");
      return;
    }
    if (!importFecha) {
      setImportError("Elegí la fecha del albarán.");
      return;
    }
    if (importLineasPreview.length === 0) {
      setImportError("Pegá al menos una línea con nombre de ítem.");
      return;
    }

    setImportIsSaving(true);
    setImportError(null);

    try {
      let itemsActuales = stockItems;
      const nuevosItems: StockItem[] = [];

      for (const linea of importLineasPreview) {
        if (linea.existente) {
          continue;
        }
        const yaCreado = nuevosItems.find(
          (it) => normalizarNombreClave(it.nombre) === normalizarNombreClave(linea.item)
        );
        if (yaCreado) {
          continue;
        }
        const { data, error: insertError } = await supabase
          .from("stock_items")
          .insert({
            nombre: linea.item.trim(),
            rubro: "Despensa/Prep",
            proveedor: importProveedor,
            unidad_compra: linea.unidad,
            buffer_pct: 15,
            activo: true,
          })
          .select(STOCK_ITEM_SELECT)
          .single();

        if (insertError) {
          throw new Error(formatPostgrestError(insertError));
        }
        nuevosItems.push(stockItemDesdeFila(data as StockItemDbRow));
      }

      itemsActuales = [...stockItems, ...nuevosItems];

      const payload = importLineasPreview.map((linea) => {
        const match =
          linea.existente ??
          itemsActuales.find(
            (it) => normalizarNombreClave(it.nombre) === normalizarNombreClave(linea.item)
          ) ??
          null;
        const cantidad = parseCantidad(linea.cantidad);
        const precio = linea.precio ? parseCantidad(linea.precio) : null;
        return {
          stockItemId: match?.id ?? null,
          stockItemNombre: linea.item.trim(),
          proveedor: importProveedor as Proveedor,
          cantidad,
          unidad: linea.unidad,
          fecha: importFecha,
          origen: "import" as const,
          precioUnitario: importTipoPrecio === "unitario" ? precio : null,
          importeTotal: importTipoPrecio === "total" ? precio : null,
        };
      });

      await insertarComprasHistorial(payload);
      await cargarDatos();
      cerrarImport();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "No se pudo importar el albarán."
      );
    } finally {
      setImportIsSaving(false);
    }
  };

  const abrirRegistrar = (item: StockItem) => {
    setRegistrarItem(item);
    setRegistrarFecha(hoyISO());
    setRegistrarCantidad(cantidadPorId[item.id] ?? "");
    setRegistrarPrecio("");
    setRegistrarTipoPrecio("unitario");
    setRegistrarFrecuencia(
      item.intervaloEstimadoDias != null ? String(item.intervaloEstimadoDias) : ""
    );
    setRegistrarError(null);
  };

  const cerrarRegistrar = () => {
    setRegistrarItem(null);
  };

  const confirmarRegistrar = async () => {
    if (!registrarItem) {
      return;
    }
    if (!registrarFecha) {
      setRegistrarError("Elegí la fecha de la última compra.");
      return;
    }
    const cantidad = parseCantidad(registrarCantidad);
    if (cantidad == null) {
      setRegistrarError("Indicá una cantidad mayor que 0.");
      return;
    }

    const frecuenciaTrim = registrarFrecuencia.trim();
    let frecuenciaDias: number | null = null;
    if (frecuenciaTrim) {
      const n = parseCantidad(frecuenciaTrim);
      if (n == null) {
        setRegistrarError("La frecuencia estimada tiene que ser un número mayor que 0.");
        return;
      }
      frecuenciaDias = Math.round(n);
    }

    setRegistrarIsSaving(true);
    setRegistrarError(null);
    try {
      const precioIngresado = registrarPrecio.trim() ? parseCantidad(registrarPrecio) : null;
      const { precioUnitario, importeTotal } = completarPrecio(
        cantidad,
        registrarTipoPrecio === "unitario" ? precioIngresado : null,
        registrarTipoPrecio === "total" ? precioIngresado : null
      );

      if (frecuenciaDias !== registrarItem.intervaloEstimadoDias) {
        const { error: updateError } = await supabase
          .from("stock_items")
          .update({ intervalo_estimado_dias: frecuenciaDias })
          .eq("id", registrarItem.id);
        if (updateError) {
          throw new Error(formatPostgrestError(updateError));
        }
      }

      const { data, error: insertError } = await supabase
        .from("compras_historial")
        .insert({
          stock_item_id: registrarItem.id,
          stock_item_nombre: registrarItem.nombre,
          proveedor: registrarItem.proveedor,
          cantidad,
          unidad: registrarItem.unidadCompra,
          fecha: registrarFecha,
          origen: "manual",
          precio_unitario: precioUnitario,
          importe_total: importeTotal,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(formatPostgrestError(insertError));
      }

      const nombreItem = registrarItem.nombre;
      await cargarDatos();
      cerrarRegistrar();
      setUndoAccion({
        tipo: "registro",
        compraId: (data as { id: string }).id,
        etiqueta: `Compra de ${nombreItem} (${formatearFechaCorta(registrarFecha)})`,
      });
    } catch (err) {
      setRegistrarError(
        err instanceof Error ? err.message : "No se pudo registrar la compra."
      );
    } finally {
      setRegistrarIsSaving(false);
    }
  };

  const abrirBorrar = (item: StockItem) => {
    setBorrarItem(item);
    setBorrarError(null);
  };

  const cerrarBorrar = () => {
    setBorrarItem(null);
    setBorrarError(null);
  };

  const confirmarBorrar = async () => {
    if (!borrarItem) {
      return;
    }
    setBorrandoId(borrarItem.id);
    setBorrarError(null);
    try {
      const { error: deleteError } = await supabase
        .from("stock_items")
        .delete()
        .eq("id", borrarItem.id);
      if (deleteError) {
        throw new Error(formatPostgrestError(deleteError));
      }
      setStockItems((prev) => prev.filter((it) => it.id !== borrarItem.id));
      setBorrarItem(null);
    } catch (err) {
      setBorrarError(err instanceof Error ? err.message : "No se pudo borrar el ítem.");
    } finally {
      setBorrandoId(null);
    }
  };

  const abrirFrecuencia = (item: StockItem) => {
    setFrecuenciaItem(item);
    setFrecuenciaValor(item.intervaloEstimadoDias != null ? String(item.intervaloEstimadoDias) : "");
    setFrecuenciaError(null);
  };

  const cerrarFrecuencia = () => {
    setFrecuenciaItem(null);
    setFrecuenciaError(null);
  };

  const confirmarFrecuencia = async () => {
    if (!frecuenciaItem) {
      return;
    }
    const trim = frecuenciaValor.trim();
    let dias: number | null = null;
    if (trim) {
      const n = parseCantidad(trim);
      if (n == null) {
        setFrecuenciaError("Tiene que ser un número mayor que 0.");
        return;
      }
      dias = Math.round(n);
    }

    setFrecuenciaIsSaving(true);
    setFrecuenciaError(null);
    try {
      const { error: updateError } = await supabase
        .from("stock_items")
        .update({ intervalo_estimado_dias: dias })
        .eq("id", frecuenciaItem.id);
      if (updateError) {
        throw new Error(formatPostgrestError(updateError));
      }
      await cargarDatos();
      setFrecuenciaItem(null);
    } catch (err) {
      setFrecuenciaError(
        err instanceof Error ? err.message : "No se pudo guardar la frecuencia estimada."
      );
    } finally {
      setFrecuenciaIsSaving(false);
    }
  };

  const abrirEditar = (item: StockItem) => {
    setEditarItem(item);
    setEditarNombre(item.nombre);
    setEditarProveedor(item.proveedor ?? "");
    setEditarRubro(item.rubro);
    setEditarUnidad(item.unidadCompra);
    setEditarBuffer(String(item.bufferPct));
    const filas = compras
      .filter((c) => c.stockItemId === item.id)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      .map(
        (c): FilaHistorialEditable => ({
          id: c.id,
          fecha: c.fecha,
          cantidad: c.cantidad != null ? String(c.cantidad) : "",
          unidad: c.unidad,
          precioUnitario: c.precioUnitario != null ? String(c.precioUnitario) : "",
          origen: c.origen,
        })
      );
    setEditarHistorial(filas);
    setEditarError(null);
  };

  const cerrarEditar = () => {
    setEditarItem(null);
    setEditarError(null);
  };

  const actualizarFilaHistorialEditar = (
    id: string,
    patch: Partial<FilaHistorialEditable>
  ) => {
    setEditarHistorial((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const borrarFilaHistorialEditar = async (fila: FilaHistorialEditable) => {
    const ok = window.confirm(
      `¿Borrar la compra del ${formatearFechaCorta(fila.fecha)}? No se puede deshacer.`
    );
    if (!ok) {
      return;
    }
    setEditarBorrandoFilaId(fila.id);
    setEditarError(null);
    try {
      const { error: deleteError } = await supabase
        .from("compras_historial")
        .delete()
        .eq("id", fila.id);
      if (deleteError) {
        throw new Error(formatPostgrestError(deleteError));
      }
      setEditarHistorial((prev) => prev.filter((f) => f.id !== fila.id));
      setCompras((prev) => prev.filter((c) => c.id !== fila.id));
    } catch (err) {
      setEditarError(err instanceof Error ? err.message : "No se pudo borrar la compra.");
    } finally {
      setEditarBorrandoFilaId(null);
    }
  };

  const guardarEditar = async () => {
    if (!editarItem) {
      return;
    }
    const nombre = editarNombre.trim();
    if (!nombre) {
      setEditarError("El nombre no puede quedar vacío.");
      return;
    }
    const bufferNum = Number(editarBuffer);
    if (!Number.isFinite(bufferNum) || bufferNum < 0 || bufferNum > 90) {
      setEditarError("El buffer tiene que ser un número entre 0 y 90.");
      return;
    }
    for (const fila of editarHistorial) {
      if (!fila.fecha) {
        setEditarError("Cada compra necesita una fecha.");
        return;
      }
      if (parseCantidad(fila.cantidad) == null) {
        setEditarError(`Cantidad inválida en la compra del ${formatearFechaCorta(fila.fecha)}.`);
        return;
      }
      if (fila.precioUnitario.trim() && parseCantidad(fila.precioUnitario) == null) {
        setEditarError(`Precio inválido en la compra del ${formatearFechaCorta(fila.fecha)}.`);
        return;
      }
    }

    setEditarIsSaving(true);
    setEditarError(null);
    try {
      const proveedorFinal = (editarProveedor || null) as Proveedor | null;
      const bufferRedondeado = Math.round(bufferNum);
      const cambioNombre = nombre !== editarItem.nombre;
      const patchItem: Record<string, unknown> = {};
      if (cambioNombre) patchItem.nombre = nombre;
      if (proveedorFinal !== editarItem.proveedor) patchItem.proveedor = proveedorFinal;
      if (editarRubro !== editarItem.rubro) patchItem.rubro = editarRubro;
      if (editarUnidad !== editarItem.unidadCompra) patchItem.unidad_compra = editarUnidad;
      if (bufferRedondeado !== editarItem.bufferPct) patchItem.buffer_pct = bufferRedondeado;

      if (Object.keys(patchItem).length > 0) {
        const { error: updateError } = await supabase
          .from("stock_items")
          .update(patchItem)
          .eq("id", editarItem.id);
        if (updateError) {
          throw new Error(formatPostgrestError(updateError));
        }
      }

      const originalPorId = new Map(compras.map((c) => [c.id, c]));
      for (const fila of editarHistorial) {
        const original = originalPorId.get(fila.id);
        if (!original) {
          continue;
        }
        const cantidad = parseCantidad(fila.cantidad);
        const precioIngresado = fila.precioUnitario.trim()
          ? parseCantidad(fila.precioUnitario)
          : null;
        const { precioUnitario, importeTotal } = completarPrecio(cantidad, precioIngresado, null);

        const sinCambios =
          fila.fecha === original.fecha &&
          cantidad === original.cantidad &&
          fila.unidad === original.unidad &&
          precioUnitario === original.precioUnitario &&
          !cambioNombre;
        if (sinCambios) {
          continue;
        }

        const patchFila: Record<string, unknown> = {
          fecha: fila.fecha,
          cantidad,
          unidad: fila.unidad,
          precio_unitario: precioUnitario,
          importe_total: importeTotal,
        };
        if (cambioNombre) {
          patchFila.stock_item_nombre = nombre;
        }

        const { error: updateFilaError } = await supabase
          .from("compras_historial")
          .update(patchFila)
          .eq("id", fila.id);
        if (updateFilaError) {
          throw new Error(formatPostgrestError(updateFilaError));
        }
      }

      await cargarDatos();
      cerrarEditar();
    } catch (err) {
      setEditarError(
        err instanceof Error ? err.message : "No se pudieron guardar los cambios."
      );
    } finally {
      setEditarIsSaving(false);
    }
  };

  /** Trae el array actual de items del pedido de un proveedor. */
  const obtenerItemsPedido = async (proveedor: Proveedor): Promise<PedidoItemDraft[]> => {
    const { data, error: fetchError } = await supabase
      .from("pedidos_proveedores")
      .select("items")
      .eq("proveedor", proveedor)
      .maybeSingle();

    if (fetchError) {
      throw new Error(formatPostgrestError(fetchError));
    }

    return Array.isArray((data as { items?: unknown } | null)?.items)
      ? ((data as { items: PedidoItemDraft[] }).items ?? [])
      : [];
  };

  const guardarItemsPedido = async (
    proveedor: Proveedor,
    items: PedidoItemDraft[]
  ): Promise<void> => {
    const { error: upsertError } = await supabase.from("pedidos_proveedores").upsert(
      {
        proveedor,
        items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "proveedor" }
    );
    if (upsertError) {
      throw new Error(formatPostgrestError(upsertError));
    }
  };

  const agregarAPedido = async (proveedor: Proveedor, entry: ItemConPrediccion) => {
    setAgregandoId(entry.item.id);
    setError(null);
    try {
      const itemsAnteriores = await obtenerItemsPedido(proveedor);

      const cantidadDraft = cantidadPorId[entry.item.id];
      const cantidad =
        cantidadDraft !== undefined && cantidadDraft.trim() !== ""
          ? cantidadDraft
          : entry.prediccion.cantidadSugerida != null
            ? String(entry.prediccion.cantidadSugerida)
            : "";

      const nuevoItem: PedidoItemDraft = {
        id: crypto.randomUUID(),
        item: entry.item.nombre,
        cantidad,
        unidad: entry.item.unidadCompra,
      };

      await guardarItemsPedido(proveedor, [...itemsAnteriores, nuevoItem]);

      setAgregadoOkId(entry.item.id);
      window.setTimeout(() => {
        setAgregadoOkId((current) => (current === entry.item.id ? null : current));
      }, 2200);
      setUndoAccion({
        tipo: "pedido",
        proveedor,
        itemsAnteriores,
        etiqueta: entry.item.nombre,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar al pedido.");
    } finally {
      setAgregandoId(null);
    }
  };

  const agregarLoteAPedido = async (proveedor: Proveedor, lista: ItemConPrediccion[]) => {
    setAgregandoLoteProveedor(proveedor);
    setError(null);
    try {
      const itemsAnteriores = await obtenerItemsPedido(proveedor);

      const nuevos: PedidoItemDraft[] = lista.map((entry) => {
        const cantidadDraft = cantidadPorId[entry.item.id];
        const cantidad =
          cantidadDraft !== undefined && cantidadDraft.trim() !== ""
            ? cantidadDraft
            : entry.prediccion.cantidadSugerida != null
              ? String(entry.prediccion.cantidadSugerida)
              : "";
        return {
          id: crypto.randomUUID(),
          item: entry.item.nombre,
          cantidad,
          unidad: entry.item.unidadCompra,
        };
      });

      await guardarItemsPedido(proveedor, [...itemsAnteriores, ...nuevos]);

      lista.forEach((entry) => {
        setAgregadoOkId(entry.item.id);
      });
      window.setTimeout(() => {
        setAgregadoOkId(null);
      }, 2200);
      setUndoAccion({
        tipo: "pedido",
        proveedor,
        itemsAnteriores,
        etiqueta: `${nuevos.length} ítems de ${proveedor}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el lote al pedido.");
    } finally {
      setAgregandoLoteProveedor(null);
    }
  };

  const deshacerAccion = async () => {
    if (!undoAccion) {
      return;
    }
    const snap = undoAccion;
    setUndoAccion(null);
    try {
      if (snap.tipo === "pedido") {
        await guardarItemsPedido(snap.proveedor, snap.itemsAnteriores);
      } else {
        const { error: deleteError } = await supabase
          .from("compras_historial")
          .delete()
          .eq("id", snap.compraId);
        if (deleteError) {
          throw new Error(formatPostgrestError(deleteError));
        }
        await cargarDatos();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer.");
    }
  };

  const renderFilaCompacta = (proveedor: string, entry: ItemConPrediccion) => {
    const { item, prediccion } = entry;
    const busy = agregandoId === item.id;
    const puedeAgregar = proveedor !== SIN_PROVEEDOR;
    const ultimoPrecio = ultimoPrecioPorItem.get(item.id);

    return (
      <li
        key={item.id}
        className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">{item.nombre}</span>
            <EstadoBadge estado={prediccion.estado} />
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {prediccion.diasParaProxima != null ? (
              prediccion.diasParaProxima <= 0 ? (
                <span className="text-red-300">
                  Atrasado {Math.abs(prediccion.diasParaProxima)} día
                  {Math.abs(prediccion.diasParaProxima) === 1 ? "" : "s"}
                </span>
              ) : (
                <>En {prediccion.diasParaProxima} día{prediccion.diasParaProxima === 1 ? "" : "s"}</>
              )
            ) : (
              "Sin historial suficiente"
            )}
            {prediccion.esEstimado ? (
              <span className="text-indigo-300"> (estimado)</span>
            ) : null}
            {ultimoPrecio != null ? (
              <span className="text-zinc-600">
                {" "}
                · {formatearPrecioUnitario(ultimoPrecio, item.unidadCompra)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={cantidadPorId[item.id] ?? ""}
            disabled={busy}
            onChange={(e) =>
              setCantidadPorId((prev) => ({ ...prev, [item.id]: e.target.value }))
            }
            aria-label={`Cantidad de ${item.nombre}`}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-center text-sm tabular-nums text-white"
          />
          <span className="w-14 shrink-0 text-xs text-zinc-500">{item.unidadCompra}</span>
          <button
            type="button"
            onClick={() => abrirRegistrar(item)}
            aria-label={`Registrar última compra de ${item.nombre}`}
            title="Registrar última compra (fecha + cantidad) a mano"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={busy || !puedeAgregar}
            onClick={() => void agregarAPedido(item.proveedor as Proveedor, entry)}
            title={
              puedeAgregar
                ? undefined
                : "Asigná un proveedor en /stock para poder agregarlo a un pedido"
            }
            aria-label={`Agregar ${item.nombre} al pedido`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-700/80 bg-emerald-800/60 text-emerald-50 transition active:scale-95 hover:bg-emerald-700/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : agregadoOkId === item.id ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            ) : (
              <Plus className="h-5 w-5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => abrirEditar(item)}
            aria-label={`Editar ${item.nombre}`}
            title="Editar nombre, proveedor, unidad o precios de compras pasadas"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => abrirBorrar(item)}
            aria-label={`Borrar ${item.nombre} de Stock`}
            title="Borrar este ítem de Stock (se cargó sin querer)"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-zinc-600 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </li>
    );
  };

  const renderFilaAlDia = (proveedor: string, entry: ItemConPrediccion) => {
    const { item, prediccion } = entry;
    const busy = agregandoId === item.id;
    const puedeAgregar = proveedor !== SIN_PROVEEDOR;
    const ultimoPrecio = ultimoPrecioPorItem.get(item.id);

    return (
      <li
        key={item.id}
        className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{item.nombre}</span>
            <EstadoBadge estado={prediccion.estado} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {prediccion.ultimaCompra ? (
              <>
                Última compra: {prediccion.ultimaCompra}
                {prediccion.intervaloTipicoDias != null ? (
                  <>
                    {" "}
                    · Ciclo {prediccion.esEstimado ? "estimado" : "típico"}:{" "}
                    {prediccion.intervaloTipicoDias} días
                    {prediccion.esEstimado ? (
                      <button
                        type="button"
                        onClick={() => abrirFrecuencia(item)}
                        className="ml-1 text-indigo-300 underline decoration-dotted hover:text-indigo-200"
                      >
                        editar
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-indigo-300">
                      Registrá otra fecha o{" "}
                      <button
                        type="button"
                        onClick={() => abrirFrecuencia(item)}
                        className="underline decoration-dotted hover:text-indigo-200"
                      >
                        cargá una frecuencia estimada
                      </button>{" "}
                      para calcular el ciclo
                    </span>
                  </>
                )}
                {prediccion.proximaFechaSugerida ? (
                  <> · Próxima sugerida: {prediccion.proximaFechaSugerida}</>
                ) : null}
              </>
            ) : (
              <span className="text-indigo-300">
                Sin compras registradas todavía. Tocá Registrar para cargar la última.
              </span>
            )}
            {ultimoPrecio != null ? (
              <span className="text-zinc-600">
                {" "}
                · {formatearPrecioUnitario(ultimoPrecio, item.unidadCompra)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={cantidadPorId[item.id] ?? ""}
            disabled={busy}
            onChange={(e) =>
              setCantidadPorId((prev) => ({ ...prev, [item.id]: e.target.value }))
            }
            aria-label={`Cantidad de ${item.nombre}`}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-xs tabular-nums text-white"
          />
          <button
            type="button"
            onClick={() => abrirRegistrar(item)}
            title="Registrar última compra (fecha + cantidad) a mano"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Registrar
          </button>
          <button
            type="button"
            disabled={busy || !puedeAgregar}
            onClick={() => void agregarAPedido(item.proveedor as Proveedor, entry)}
            title={
              puedeAgregar
                ? undefined
                : "Asigná un proveedor en /stock para poder agregarlo a un pedido"
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )}
            {agregadoOkId === item.id ? "Agregado" : "Agregar"}
          </button>
          <button
            type="button"
            onClick={() => abrirEditar(item)}
            aria-label={`Editar ${item.nombre}`}
            title="Editar nombre, proveedor, unidad o precios de compras pasadas"
            className="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-zinc-600 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => abrirBorrar(item)}
            aria-label={`Borrar ${item.nombre} de Stock`}
            title="Borrar este ítem de Stock (se cargó sin querer)"
            className="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-zinc-600 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </li>
    );
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Compras</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cada cuánto conviene volver a pedir cada ítem de{" "}
              <span className="text-zinc-300">Stock</span>, según el historial real de compras
              (sin conteo de stock: el margen de seguridad adelanta el aviso antes de que se
              acabe).
            </p>
          </div>
          <button
            type="button"
            onClick={() => abrirImport()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-800/50"
          >
            <ListPlus className="h-4 w-4" aria-hidden />
            Importar albarán
          </button>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando compras...
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <input
                  ref={buscadorRef}
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar ítem..."
                  aria-label="Buscar ítem"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-8 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                />
                {busqueda ? (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {!soloUrgentes ? (
                  <button
                    type="button"
                    onClick={alternarExpandirTodo}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    {todoExpandido ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {todoExpandido ? "Colapsar todo" : "Expandir todo"}
                  </button>
                ) : null}
                <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <input
                    type="checkbox"
                    checked={soloUrgentes}
                    onChange={(e) => setSoloUrgentes(e.target.checked)}
                    className="size-4 rounded border-zinc-600 bg-zinc-900 accent-orange-600"
                  />
                  Solo urgentes
                  <kbd className="hidden rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500 sm:inline">
                    U
                  </kbd>
                </label>
              </div>
            </div>

            {!soloUrgentes ? (
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <KpiCard
                  icono={<AlertTriangle className="h-4 w-4" aria-hidden />}
                  titulo="Atrasados"
                  valor={kpis.Atrasado}
                  tono="text-red-300"
                />
                <KpiCard
                  icono={<CalendarClock className="h-4 w-4" aria-hidden />}
                  titulo="Pedir pronto"
                  valor={kpis["Pedir pronto"]}
                  tono="text-amber-300"
                />
                <KpiCard
                  icono={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                  titulo="OK"
                  valor={kpis.OK}
                  tono="text-emerald-300"
                />
                <KpiCard
                  icono={<HelpCircle className="h-4 w-4" aria-hidden />}
                  titulo="Sin datos"
                  valor={kpis["Sin datos"]}
                  tono="text-indigo-300"
                  onClick={
                    kpis["Sin datos"] > 0
                      ? () => {
                          setSoloUrgentes(false);
                          setSinDatosExpandido(true);
                        }
                      : undefined
                  }
                />
                <KpiCard
                  icono={<TrendingUp className="h-4 w-4" aria-hidden />}
                  titulo="Subidas 90 días"
                  valor={subidasRecientes}
                  tono="text-orange-300"
                />
              </div>
            ) : null}

            {cambiosPrecioVisibles.length > 0 ? (
              <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <button
                  type="button"
                  onClick={() => setCambiosPrecioExpandido((v) => !v)}
                  className="flex w-full items-center gap-2 text-left text-sm uppercase tracking-[0.14em] text-zinc-400 transition hover:text-zinc-200"
                >
                  {cambiosPrecioExpandido ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Cambios de precio
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-400">
                    {cambiosPrecio.length}
                  </span>
                  {subidasRecientes > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-900/60 bg-orange-950/40 px-2 py-0.5 text-[11px] font-medium text-orange-300">
                      <TrendingUp className="h-3 w-3" aria-hidden />
                      {subidasRecientes} subidas · 90 días
                    </span>
                  ) : null}
                </button>
                {cambiosPrecioExpandido ? (
                  <>
                    <p className="mb-4 mt-3 text-xs text-zinc-500">
                      Comparación del precio por kg, caja o unidad entre albaranes consecutivos
                      del mismo ítem y proveedor. Solo se muestran variaciones de al menos 0,5 % o
                      2 céntimos.
                    </p>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800/80">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <thead className="sticky top-0 bg-zinc-900/95 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Ítem</th>
                            <th className="px-3 py-2 font-medium">Proveedor</th>
                            <th className="px-3 py-2 font-medium text-right">Antes</th>
                            <th className="px-3 py-2 font-medium text-right">Ahora</th>
                            <th className="px-3 py-2 font-medium text-right">Cambio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/80">
                          {cambiosPrecio.map((c, i) => {
                            const subio = c.variacionPct > 0;
                            const pct = `${subio ? "+" : ""}${c.variacionPct.toLocaleString("es-ES", {
                              maximumFractionDigits: 1,
                            })} %`;
                            return (
                              <tr
                                key={`${c.fecha}-${c.nombre}-${c.proveedor}-${i}`}
                                className="text-zinc-200"
                              >
                                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                                  {formatearFechaCorta(c.fecha)}
                                </td>
                                <td className="px-3 py-2 font-medium text-white">{c.nombre}</td>
                                <td className="px-3 py-2 text-zinc-400">{c.proveedor ?? "—"}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-400">
                                  {formatearPrecioUnitario(c.precioAnterior, c.unidad)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-white">
                                  {formatearPrecioUnitario(c.precioNuevo, c.unidad)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span
                                    className={`inline-flex items-center justify-end gap-1 tabular-nums text-xs font-medium ${
                                      subio ? "text-red-300" : "text-emerald-300"
                                    }`}
                                  >
                                    {subio ? (
                                      <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    ) : (
                                      <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    )}
                                    {pct}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            {itemsConPrediccion.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay ítems activos en Stock, o no tienen historial de compras. Cargá el
                catálogo en <span className="text-zinc-300">/stock</span> e importá algún albarán
                acá para empezar.
              </p>
            ) : hayBusqueda &&
              urgentesPorProveedor.length === 0 &&
              alDiaPorProveedor.length === 0 &&
              sinDatosPorProveedor.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Ningún ítem coincide con “{busqueda}”.
              </p>
            ) : (
              <>
                {totalUrgentes === 0 && !hayBusqueda ? (
                  <div className="mb-6 flex flex-col gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                      Nada urgente para pedir.
                    </div>
                    {soloUrgentes && (kpis.OK > 0 || kpis["Sin datos"] > 0) ? (
                      <p className="text-xs text-emerald-300/80">
                        Desactivá <span className="text-emerald-100">Solo urgentes</span> para ver{" "}
                        {kpis.OK + kpis["Sin datos"]} ítem
                        {kpis.OK + kpis["Sin datos"] === 1 ? "" : "s"} al día.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {urgentesPorProveedor.length > 0 ? (
                  <section className="mb-6">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                      Para pedir
                      <span className="rounded-full bg-orange-900/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-100">
                        {totalUrgentes}
                      </span>
                    </h2>
                    <div className="space-y-4">
                      {urgentesPorProveedor.map(([proveedor, lista]) => {
                        const clave = `urgentes:${proveedor}`;
                        const colapsado = gruposColapsados.has(clave);
                        return (
                          <div
                            key={proveedor}
                            className="overflow-hidden rounded-xl border border-zinc-800"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/60 px-3 py-2">
                              <button
                                type="button"
                                onClick={() => toggleGrupo(clave)}
                                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 transition hover:text-zinc-200"
                              >
                                {colapsado ? (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                {proveedor}
                                <span className="text-zinc-600">({lista.length})</span>
                              </button>
                              {proveedor !== SIN_PROVEEDOR ? (
                                <button
                                  type="button"
                                  disabled={agregandoLoteProveedor === proveedor}
                                  onClick={() =>
                                    void agregarLoteAPedido(proveedor as Proveedor, lista)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/70 bg-emerald-900/40 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-800/40 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {agregandoLoteProveedor === proveedor ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Layers className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                  Agregar los {lista.length} al pedido
                                </button>
                              ) : null}
                            </div>
                            {!colapsado ? (
                              <ul className="divide-y divide-zinc-800/90 bg-zinc-950/30">
                                {lista.map((entry) => renderFilaCompacta(proveedor, entry))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {!soloUrgentes && alDiaPorProveedor.length > 0 ? (
                  <section className="mb-6">
                    <button
                      type="button"
                      onClick={() => setAlDiaExpandido((v) => !v)}
                      className="mb-3 flex w-full items-center gap-2 rounded-lg py-1 text-left text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-300"
                    >
                      {alDiaExpandido || hayBusqueda ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      Al día
                      <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-400">
                        {kpis.OK}
                      </span>
                    </button>
                    {alDiaExpandido || hayBusqueda ? (
                      <div className="space-y-4 opacity-90">
                        {alDiaPorProveedor.map(([proveedor, lista]) => {
                          const clave = `alDia:${proveedor}`;
                          const colapsado = gruposColapsados.has(clave);
                          return (
                            <div key={proveedor}>
                              <button
                                type="button"
                                onClick={() => toggleGrupo(clave)}
                                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 transition hover:text-zinc-300"
                              >
                                {colapsado ? (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                {proveedor}
                                <span className="text-zinc-600">({lista.length})</span>
                              </button>
                              {!colapsado ? (
                                <ul className="space-y-2" role="list">
                                  {lista.map((entry) => renderFilaAlDia(proveedor, entry))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {!soloUrgentes && sinDatosPorProveedor.length > 0 ? (
                  <section className="mb-6 rounded-xl border border-indigo-900/40 bg-indigo-950/10 p-3">
                    <button
                      type="button"
                      onClick={() => setSinDatosExpandido((v) => !v)}
                      className="flex w-full items-center gap-2 rounded-lg py-1 text-left text-sm font-semibold uppercase tracking-[0.14em] text-indigo-300 transition hover:text-indigo-200"
                    >
                      {sinDatosExpandido || hayBusqueda ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
                      Sin datos
                      <span className="rounded-full bg-indigo-900/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-indigo-100">
                        {kpis["Sin datos"]}
                      </span>
                    </button>
                    {sinDatosExpandido || hayBusqueda ? (
                      <>
                        <p className="mb-3 mt-2 text-[11px] leading-relaxed text-indigo-200/70">
                          Sin albarán todavía. Tocá <span className="text-indigo-200">Registrar</span>{" "}
                          para cargar a mano cuándo y cuánto se compró — con 2 fechas cargadas ya se
                          puede estimar el ciclo y el ítem pasa a Al día / Para pedir.
                        </p>
                        <div className="space-y-4">
                          {sinDatosPorProveedor.map(([proveedor, lista]) => {
                            const clave = `sinDatos:${proveedor}`;
                            const colapsado = gruposColapsados.has(clave);
                            return (
                              <div key={proveedor}>
                                <button
                                  type="button"
                                  onClick={() => toggleGrupo(clave)}
                                  className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300/80 transition hover:text-indigo-200"
                                >
                                  {colapsado ? (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  )}
                                  {proveedor}
                                  <span className="text-indigo-400/60">({lista.length})</span>
                                </button>
                                {!colapsado ? (
                                  <ul className="space-y-2" role="list">
                                    {lista.map((entry) => renderFilaAlDia(proveedor, entry))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </section>
                ) : null}
              </>
            )}
          </>
        )}

        {importAbierto ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarImport();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-compras-title"
              className="flex max-h-[min(92dvh,42rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(88vh,38rem)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="import-compras-title" className="text-sm font-semibold text-white">
                    Importar albarán
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Elegí proveedor y fecha, y pegá las líneas del albarán. Los ítems que no
                    existan en Stock se crean automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarImport()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="import-proveedor"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Proveedor
                    </label>
                    <select
                      id="import-proveedor"
                      value={importProveedor}
                      onChange={(e) => setImportProveedor(e.target.value as Proveedor)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      <option value="">Elegir...</option>
                      {PROVEEDORES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="import-fecha"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Fecha del albarán
                    </label>
                    <input
                      id="import-fecha"
                      type="date"
                      value={importFecha}
                      onChange={(e) => setImportFecha(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="import-unidad-default"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Unidad por defecto
                    </label>
                    <select
                      id="import-unidad-default"
                      value={importUnidadDefault}
                      onChange={(e) => setImportUnidadDefault(e.target.value as UnidadMedida)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="import-tipo-precio"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      La 4ta columna del precio es
                    </label>
                    <select
                      id="import-tipo-precio"
                      value={importTipoPrecio}
                      onChange={(e) => setImportTipoPrecio(e.target.value as "unitario" | "total")}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      <option value="unitario">Precio unitario</option>
                      <option value="total">Total de la línea</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="import-textarea"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Pegá las líneas del albarán
                  </label>
                  <textarea
                    id="import-textarea"
                    value={importTexto}
                    onChange={(e) => setImportTexto(e.target.value)}
                    rows={10}
                    autoFocus
                    spellCheck={false}
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                    placeholder={`Salmón: 8 Kilo\nAtún: 5 Kilo\nAguacate | 2 | Caja | 12.50`}
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    El precio (opcional) solo se reconoce con formato{" "}
                    <span className="font-mono text-zinc-500">nombre | cantidad | unidad | precio</span>{" "}
                    o separado por tabs.
                  </p>
                </div>
                {importError ? (
                  <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                    {importError}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">{importLineasPreview.length}</span>{" "}
                  línea(s) reconocida(s)
                </p>
                {importLineasPreview.length > 0 ? (
                  <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/60 px-3 py-2">
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-zinc-300">
                      {importLineasPreview.slice(0, 20).map((l, i) => (
                        <li key={i} className="truncate">
                          <span className="text-zinc-600">·</span>{" "}
                          <span className="font-medium text-zinc-100">{l.item}</span>
                          <span className="text-zinc-500">
                            {" "}
                            → {l.cantidad || "—"} {l.unidad}
                            {l.precio ? ` · ${l.precio}€` : ""}
                          </span>
                          {l.existente ? (
                            <span className="text-emerald-400"> (vinculado)</span>
                          ) : (
                            <span className="text-amber-400"> (nuevo en Stock)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {importLineasPreview.length > 20 ? (
                      <p className="mt-1.5 text-[10px] text-zinc-600">
                        … y {importLineasPreview.length - 20} más
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarImport()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importIsSaving || importLineasPreview.length === 0}
                  onClick={() => void confirmarImport()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {importIsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Importar {importLineasPreview.length > 0 ? importLineasPreview.length : ""}{" "}
                  línea(s)
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {registrarItem ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarRegistrar();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="registrar-compra-title"
              className="flex max-h-[min(92dvh,32rem)] w-full max-w-md flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(88vh,30rem)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="registrar-compra-title" className="text-sm font-semibold text-white">
                    Registrar última compra
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Para <span className="text-zinc-300">{registrarItem.nombre}</span>, sin
                    albarán: cargá cuánto y cuándo se compró por última vez para que la
                    predicción de urgencia tenga con qué calcular.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarRegistrar()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="registrar-fecha"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Fecha de la compra
                    </label>
                    <input
                      id="registrar-fecha"
                      type="date"
                      value={registrarFecha}
                      onChange={(e) => setRegistrarFecha(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="registrar-cantidad"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Cantidad ({registrarItem.unidadCompra})
                    </label>
                    <input
                      id="registrar-cantidad"
                      type="text"
                      inputMode="decimal"
                      value={registrarCantidad}
                      onChange={(e) => setRegistrarCantidad(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="registrar-precio"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Precio (opcional)
                    </label>
                    <input
                      id="registrar-precio"
                      type="text"
                      inputMode="decimal"
                      value={registrarPrecio}
                      onChange={(e) => setRegistrarPrecio(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="registrar-tipo-precio"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Ese precio es
                    </label>
                    <select
                      id="registrar-tipo-precio"
                      value={registrarTipoPrecio}
                      onChange={(e) =>
                        setRegistrarTipoPrecio(e.target.value as "unitario" | "total")
                      }
                      disabled={!registrarPrecio.trim()}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50"
                    >
                      <option value="unitario">Precio unitario</option>
                      <option value="total">Total de la compra</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="registrar-frecuencia"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Cada cuántos días aprox. se repite (opcional)
                  </label>
                  <input
                    id="registrar-frecuencia"
                    type="text"
                    inputMode="numeric"
                    value={registrarFrecuencia}
                    onChange={(e) => setRegistrarFrecuencia(e.target.value)}
                    placeholder="Ej: 30"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Solo hace falta si es la primera compra que cargás de este ítem: con una
                    estimación tuya ya se puede calcular la urgencia, sin esperar a una 2da
                    compra real.
                  </p>
                </div>
                {registrarError ? (
                  <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                    {registrarError}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarRegistrar()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={registrarIsSaving}
                  onClick={() => void confirmarRegistrar()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {registrarIsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {borrarItem ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarBorrar();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="borrar-item-title"
              className="flex w-full max-w-sm flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="borrar-item-title" className="text-sm font-semibold text-white">
                    Borrar ítem de Stock
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Vas a borrar <span className="text-zinc-300">{borrarItem.nombre}</span> del
                    catálogo de Stock. Ya no va a aparecer en Compras ni en Pedidos. Esta acción
                    no se puede deshacer (el historial de compras que ya tenía queda guardado,
                    solo se desvincula del ítem).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarBorrar()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {borrarError ? (
                <p className="mx-4 mt-3 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                  {borrarError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarBorrar()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={borrandoId === borrarItem.id}
                  onClick={() => void confirmarBorrar()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {borrandoId === borrarItem.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Borrar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {frecuenciaItem ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarFrecuencia();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="frecuencia-title"
              className="flex w-full max-w-sm flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="frecuencia-title" className="text-sm font-semibold text-white">
                    Frecuencia estimada
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Para <span className="text-zinc-300">{frecuenciaItem.nombre}</span>: cada
                    cuántos días aprox. volvés a comprarlo. Con esto se puede calcular la
                    urgencia aunque todavía tenga una sola compra registrada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarFrecuencia()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="px-4 py-3">
                <label
                  htmlFor="frecuencia-dias"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                >
                  Días aprox.
                </label>
                <input
                  id="frecuencia-dias"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={frecuenciaValor}
                  onChange={(e) => setFrecuenciaValor(e.target.value)}
                  placeholder="Ej: 30"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Dejalo vacío para borrar la estimación (vuelve a quedar en Sin datos hasta la
                  próxima compra real).
                </p>
                {frecuenciaError ? (
                  <p className="mt-2 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                    {frecuenciaError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-800 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarFrecuencia()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={frecuenciaIsSaving}
                  onClick={() => void confirmarFrecuencia()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {frecuenciaIsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editarItem ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarEditar();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="editar-item-title"
              className="flex max-h-[min(92dvh,42rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(88vh,38rem)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="editar-item-title" className="text-sm font-semibold text-white">
                    Editar ítem
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Cambiá nombre, proveedor o unidad, y corregí cantidades o precios de compras
                    ya cargadas (por errores de importación o de carga manual).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarEditar()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
                <div>
                  <label
                    htmlFor="editar-nombre"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Nombre
                  </label>
                  <input
                    id="editar-nombre"
                    type="text"
                    value={editarNombre}
                    onChange={(e) => setEditarNombre(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label
                      htmlFor="editar-proveedor"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Proveedor
                    </label>
                    <select
                      id="editar-proveedor"
                      value={editarProveedor}
                      onChange={(e) => setEditarProveedor(e.target.value as Proveedor | "")}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      <option value="">Sin proveedor</option>
                      {PROVEEDORES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="editar-rubro"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Rubro
                    </label>
                    <select
                      id="editar-rubro"
                      value={editarRubro}
                      onChange={(e) => setEditarRubro(normalizarRubro(e.target.value))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      {RUBROS_INGREDIENTE.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="editar-unidad"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Unidad
                    </label>
                    <select
                      id="editar-unidad"
                      value={editarUnidad}
                      onChange={(e) => setEditarUnidad(e.target.value as UnidadMedida)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="editar-buffer"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Buffer %
                    </label>
                    <input
                      id="editar-buffer"
                      type="number"
                      min={0}
                      max={90}
                      value={editarBuffer}
                      onChange={(e) => setEditarBuffer(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs tabular-nums text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Historial de compras{" "}
                    {editarHistorial.length > 0 ? `(${editarHistorial.length})` : ""}
                  </p>
                  {editarHistorial.length === 0 ? (
                    <p className="text-xs italic text-zinc-600">
                      Sin compras registradas todavía para este ítem.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {editarHistorial.map((fila) => (
                        <li
                          key={fila.id}
                          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2"
                        >
                          <input
                            type="date"
                            value={fila.fecha}
                            onChange={(e) =>
                              actualizarFilaHistorialEditar(fila.id, { fecha: e.target.value })
                            }
                            aria-label={`Fecha de la compra del ${formatearFechaCorta(fila.fecha)}`}
                            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={fila.cantidad}
                            onChange={(e) =>
                              actualizarFilaHistorialEditar(fila.id, { cantidad: e.target.value })
                            }
                            aria-label="Cantidad"
                            placeholder="Cant."
                            className="w-16 shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-xs tabular-nums text-zinc-200 outline-none focus:border-zinc-500"
                          />
                          <select
                            value={fila.unidad}
                            onChange={(e) =>
                              actualizarFilaHistorialEditar(fila.id, {
                                unidad: e.target.value as UnidadMedida,
                              })
                            }
                            aria-label="Unidad"
                            className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                          >
                            {UNIDADES.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={fila.precioUnitario}
                            onChange={(e) =>
                              actualizarFilaHistorialEditar(fila.id, {
                                precioUnitario: e.target.value,
                              })
                            }
                            aria-label="Precio unitario"
                            placeholder="Precio/u"
                            className="w-20 shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-xs tabular-nums text-zinc-200 outline-none focus:border-zinc-500"
                          />
                          <button
                            type="button"
                            disabled={editarBorrandoFilaId === fila.id}
                            onClick={() => void borrarFilaHistorialEditar(fila)}
                            aria-label={`Borrar compra del ${formatearFechaCorta(fila.fecha)}`}
                            title="Borrar esta compra del historial"
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-1.5 text-zinc-600 transition hover:border-red-900/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                          >
                            {editarBorrandoFilaId === fila.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {editarError ? (
                  <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                    {editarError}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarEditar()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={editarIsSaving}
                  onClick={() => void guardarEditar()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {editarIsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {undoAccion ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm sm:inset-x-6"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-zinc-200">
            {undoAccion.tipo === "pedido" ? (
              <>
                <span className="font-medium text-white">{undoAccion.etiqueta}</span> agregado a{" "}
                {undoAccion.proveedor}
              </>
            ) : (
              <span className="font-medium text-white">{undoAccion.etiqueta} registrada</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void deshacerAccion()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Deshacer
            <kbd className="hidden rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">
              Z
            </kbd>
          </button>
        </div>
      ) : null}
    </main>
  );
}
