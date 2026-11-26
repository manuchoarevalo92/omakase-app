"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  useCallback,
  useEffectEvent,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
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
  X,
} from "lucide-react";
import {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  cx,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fecha,
  Hoja,
  Interruptor,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
  useAvisos,
  vibrar,
} from "@/app/ui";

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
  type EstadoCompra,
  type PrediccionCompra,
} from "@/src/lib/compras-prediccion";
import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import {
  parsearLineasMasivo,
  type LineaParseada,
} from "@/src/lib/parseo-lineas";
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
  fetchProveedores,
  ordenarProveedores,
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

const ESTADO_ICONO: Record<EstadoCompra, ReactNode> = {
  Atrasado: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  "Pedir pronto": <CalendarClock className="h-3.5 w-3.5" aria-hidden />,
  OK: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  "Sin datos": <HelpCircle className="h-3.5 w-3.5" aria-hidden />,
};

/** Tono de la etiqueta de estado (tokens del sistema de diseño). */
const ESTADO_TONO: Record<
  EstadoCompra,
  "peligro" | "alerta" | "exito" | "info"
> = {
  Atrasado: "peligro",
  "Pedir pronto": "alerta",
  OK: "exito",
  "Sin datos": "info",
};

/** Input chico dentro de una fila (cantidad, precio…), como en MEP deli. */
const INPUT_FILA =
  "h-11 rounded-control bg-fill px-2 font-mono text-[1rem] tabular-nums text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2 disabled:opacity-50";

const LISTA_AGRUPADA =
  "overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

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
  icono: ReactNode;
  titulo: string;
  valor: number;
  /** Clase de color de texto con token (text-danger, text-warning…). */
  tono: string;
  className?: string;
  onClick?: () => void;
}) {
  const { icono, titulo, valor, tono, className, onClick } = props;
  const contenido = (
    <>
      <span
        className={cx(
          "flex items-center gap-1.5 text-[0.8rem] font-semibold",
          tono,
        )}
      >
        {icono}
        {titulo}
      </span>
      <span className="mt-1 block text-[1.75rem] font-semibold leading-none tabular-nums text-label">
        {valor}
      </span>
    </>
  );
  const clases = cx(
    "block min-h-[5.25rem] rounded-card bg-surface-3 px-4 py-3 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
    className,
  );
  if (!onClick) {
    return <div className={clases}>{contenido}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        vibrar();
        onClick();
      }}
      className={cx(
        clases,
        "relative transition active:scale-[0.98] active:bg-fill",
      )}
    >
      {contenido}
      <ChevronRight
        className="absolute right-3 top-3 h-4 w-4 text-label-3"
        aria-hidden
      />
    </button>
  );
}

function EstadoBadge(props: { estado: EstadoCompra }) {
  const { estado } = props;
  return (
    <Etiqueta tono={ESTADO_TONO[estado]} icono={ESTADO_ICONO[estado]}>
      {estado}
    </Etiqueta>
  );
}

/** Encabezado de sección que pliega/despliega su contenido. */
function TituloPlegable(props: {
  abierto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { abierto, onToggle, children } = props;
  return (
    <button
      type="button"
      aria-expanded={abierto}
      onClick={() => {
        vibrar();
        onToggle();
      }}
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3 transition active:bg-fill"
    >
      {abierto ? (
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {children}
    </button>
  );
}

export default function ComprasPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([...PROVEEDORES]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [agregadoOkId, setAgregadoOkId] = useState<string | null>(null);
  const [agregandoLoteProveedor, setAgregandoLoteProveedor] = useState<
    string | null
  >(null);
  const [undoAccion, setUndoAccion] = useState<SnapshotAccion | null>(null);

  const [cantidadPorId, setCantidadPorId] = useState<Record<string, string>>(
    {},
  );
  const [busqueda, setBusqueda] = useState("");
  const [soloUrgentes, setSoloUrgentes] = useState(() =>
    leerSoloUrgentesGuardado(),
  );
  const [alDiaExpandido, setAlDiaExpandido] = useState(false);
  const [sinDatosExpandido, setSinDatosExpandido] = useState(true);
  const [cambiosPrecioExpandido, setCambiosPrecioExpandido] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(
    () => new Set(),
  );

  const [importAbierto, setImportAbierto] = useState(false);
  const [importProveedor, setImportProveedor] = useState<Proveedor | "">("");
  const [importFecha, setImportFecha] = useState(hoyISO());
  const [importUnidadDefault, setImportUnidadDefault] =
    useState<UnidadMedida>("Unidad");
  const [importTipoPrecio, setImportTipoPrecio] = useState<
    "unitario" | "total"
  >("unitario");
  const [importTexto, setImportTexto] = useState("");
  const [importIsSaving, setImportIsSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [registrarItem, setRegistrarItem] = useState<StockItem | null>(null);
  const [registrarFecha, setRegistrarFecha] = useState(hoyISO());
  const [registrarCantidad, setRegistrarCantidad] = useState("");
  const [registrarPrecio, setRegistrarPrecio] = useState("");
  const [registrarTipoPrecio, setRegistrarTipoPrecio] = useState<
    "unitario" | "total"
  >("unitario");
  const [registrarFrecuencia, setRegistrarFrecuencia] = useState("");
  const [registrarIsSaving, setRegistrarIsSaving] = useState(false);
  const [registrarError, setRegistrarError] = useState<string | null>(null);

  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const [frecuenciaItem, setFrecuenciaItem] = useState<StockItem | null>(null);
  const [frecuenciaValor, setFrecuenciaValor] = useState("");
  const [frecuenciaIsSaving, setFrecuenciaIsSaving] = useState(false);
  const [frecuenciaError, setFrecuenciaError] = useState<string | null>(null);

  const [editarItem, setEditarItem] = useState<StockItem | null>(null);
  const [editarNombre, setEditarNombre] = useState("");
  const [editarProveedor, setEditarProveedor] = useState<Proveedor | "">("");
  const [editarRubro, setEditarRubro] =
    useState<RubroIngrediente>("Despensa/Prep");
  const [editarUnidad, setEditarUnidad] = useState<UnidadMedida>("Unidad");
  const [editarBuffer, setEditarBuffer] = useState("15");
  const [editarHistorial, setEditarHistorial] = useState<
    FilaHistorialEditable[]
  >([]);
  const [editarIsSaving, setEditarIsSaving] = useState(false);
  const [editarError, setEditarError] = useState<string | null>(null);
  const [editarBorrandoFilaId, setEditarBorrandoFilaId] = useState<
    string | null
  >(null);

  const buscadorRef = useRef<HTMLInputElement>(null);
  /** Snapshots ya deshechos (para no deshacer dos veces con Z + botón del aviso). */
  const deshechosRef = useRef(new WeakSet<SnapshotAccion>());
  const { aviso, confirmar } = useAvisos();

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, historial, listaProveedores] = await Promise.all([
        fetchStockItems(),
        fetchComprasHistorial(),
        fetchProveedores(),
      ]);
      setStockItems(items);
      setCompras(historial);
      setProveedores(listaProveedores);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_SOLO_URGENTES,
        soloUrgentes ? "1" : "0",
      );
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
    [compras],
  );

  const ultimoPrecioPorItem = useMemo(
    () => ultimoPrecioUnitarioPorStockItem(compras),
    [compras],
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
          item.intervaloEstimadoDias,
        );
        return { item, prediccion };
      });
  }, [stockItems, comprasPorStockItem]);

  // Cantidad a mostrar: lo que escribió el usuario o, si no tocó nada, la sugerida.
  const cantidades = useMemo(() => {
    const next: Record<string, string> = {};
    itemsConPrediccion.forEach(({ item, prediccion }) => {
      if (prediccion.cantidadSugerida != null) {
        next[item.id] = String(prediccion.cantidadSugerida);
      }
    });
    return { ...next, ...cantidadPorId };
  }, [itemsConPrediccion, cantidadPorId]);

  const kpis = useMemo(() => {
    const base = {
      Atrasado: 0,
      "Pedir pronto": 0,
      OK: 0,
      "Sin datos": 0,
    } as Record<EstadoCompra, number>;
    itemsConPrediccion.forEach(({ prediccion }) => {
      base[prediccion.estado] += 1;
    });
    return base;
  }, [itemsConPrediccion]);

  const cambiosPrecio = useMemo(
    () => detectarCambiosPrecio(compras),
    [compras],
  );

  const cambiosPrecioRecientes = useMemo(
    () => cambiosPrecioDesde(compras, fechaHaceDias(90)),
    [compras],
  );

  const subidasRecientes = useMemo(
    () => cambiosPrecioRecientes.filter((c) => c.variacionPct > 0).length,
    [cambiosPrecioRecientes],
  );

  const busquedaNormalizada = normalizarBusqueda(busqueda);

  const itemsFiltrados = useMemo(() => {
    if (!busquedaNormalizada) {
      return itemsConPrediccion;
    }
    return itemsConPrediccion.filter((entry) =>
      normalizarBusqueda(entry.item.nombre).includes(busquedaNormalizada),
    );
  }, [itemsConPrediccion, busquedaNormalizada]);

  const agruparPorProveedor = useCallback(
    (lista: ItemConPrediccion[]): [string, ItemConPrediccion[]][] => {
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
      const vistos = new Set<string>();
      ordenarProveedores([...proveedores, ...grupos.keys()]).forEach((p) => {
        if (p === SIN_PROVEEDOR) return;
        const l = grupos.get(p);
        if (l && l.length > 0) {
          ordenados.push([p, l]);
          vistos.add(p);
        }
      });
      grupos.forEach((l, clave) => {
        if (clave !== SIN_PROVEEDOR && !vistos.has(clave) && l.length > 0) {
          ordenados.push([clave, l]);
        }
      });
      const sinProveedor = grupos.get(SIN_PROVEEDOR);
      if (sinProveedor && sinProveedor.length > 0) {
        ordenados.push([SIN_PROVEEDOR, sinProveedor]);
      }
      return ordenados;
    },
    [proveedores],
  );

  const urgentesPorProveedor = useMemo(
    () =>
      agruparPorProveedor(
        itemsFiltrados.filter((e) => esUrgente(e.prediccion.estado)),
      ),
    [itemsFiltrados, agruparPorProveedor],
  );
  const alDiaPorProveedor = useMemo(
    () =>
      agruparPorProveedor(
        itemsFiltrados.filter((e) => e.prediccion.estado === "OK"),
      ),
    [itemsFiltrados, agruparPorProveedor],
  );
  const sinDatosPorProveedor = useMemo(
    () =>
      agruparPorProveedor(
        itemsFiltrados.filter((e) => e.prediccion.estado === "Sin datos"),
      ),
    [itemsFiltrados, agruparPorProveedor],
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

  const todoExpandido =
    alDiaExpandido && sinDatosExpandido && gruposColapsados.size === 0;
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

  const cambiosPrecioVisibles = soloUrgentes ? [] : cambiosPrecio;

  const importLineasPreview = useMemo(() => {
    if (!importAbierto) {
      return [] as (LineaParseada & { existente: StockItem | null })[];
    }
    return parsearLineasMasivo(importTexto, importUnidadDefault)
      .filter((l) => l.item.trim().length > 0)
      .map((l) => ({
        ...l,
        existente: buscarStockItemPorNombre(l.item, stockItems),
      }));
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
          (it) =>
            normalizarNombreClave(it.nombre) ===
            normalizarNombreClave(linea.item),
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
            (it) =>
              normalizarNombreClave(it.nombre) ===
              normalizarNombreClave(linea.item),
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
      aviso(
        `Albarán importado: ${payload.length} ${payload.length === 1 ? "línea" : "líneas"}`,
        { tono: "exito" },
      );
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "No se pudo importar el albarán.",
      );
    } finally {
      setImportIsSaving(false);
    }
  };

  const abrirRegistrar = (item: StockItem) => {
    setRegistrarItem(item);
    setRegistrarFecha(hoyISO());
    setRegistrarCantidad(cantidades[item.id] ?? "");
    setRegistrarPrecio("");
    setRegistrarTipoPrecio("unitario");
    setRegistrarFrecuencia(
      item.intervaloEstimadoDias != null
        ? String(item.intervaloEstimadoDias)
        : "",
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
        setRegistrarError(
          "La frecuencia estimada tiene que ser un número mayor que 0.",
        );
        return;
      }
      frecuenciaDias = Math.round(n);
    }

    setRegistrarIsSaving(true);
    setRegistrarError(null);
    try {
      const precioIngresado = registrarPrecio.trim()
        ? parseCantidad(registrarPrecio)
        : null;
      const { precioUnitario, importeTotal } = completarPrecio(
        cantidad,
        registrarTipoPrecio === "unitario" ? precioIngresado : null,
        registrarTipoPrecio === "total" ? precioIngresado : null,
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
      anunciarDeshacer({
        tipo: "registro",
        compraId: (data as { id: string }).id,
        etiqueta: `Compra de ${nombreItem} (${formatearFechaCorta(registrarFecha)})`,
      });
    } catch (err) {
      setRegistrarError(
        err instanceof Error ? err.message : "No se pudo registrar la compra.",
      );
    } finally {
      setRegistrarIsSaving(false);
    }
  };

  const abrirBorrar = async (borrarItem: StockItem) => {
    const ok = await confirmar({
      titulo: `¿Borrar «${borrarItem.nombre}» de Stock?`,
      texto:
        "Ya no va a aparecer en Compras ni en Pedidos. No se puede deshacer (el historial de compras queda guardado, solo se desvincula del ítem).",
      confirmar: "Borrar ítem",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setBorrandoId(borrarItem.id);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("stock_items")
        .delete()
        .eq("id", borrarItem.id);
      if (deleteError) {
        throw new Error(formatPostgrestError(deleteError));
      }
      setStockItems((prev) => prev.filter((it) => it.id !== borrarItem.id));
      aviso(`${borrarItem.nombre}: borrado de Stock`, { tono: "exito" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo borrar el ítem.",
      );
    } finally {
      setBorrandoId(null);
    }
  };

  const abrirFrecuencia = (item: StockItem) => {
    setFrecuenciaItem(item);
    setFrecuenciaValor(
      item.intervaloEstimadoDias != null
        ? String(item.intervaloEstimadoDias)
        : "",
    );
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
      aviso("Frecuencia guardada", { tono: "exito" });
    } catch (err) {
      setFrecuenciaError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la frecuencia estimada.",
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
      .map((c): FilaHistorialEditable => ({
        id: c.id,
        fecha: c.fecha,
        cantidad: c.cantidad != null ? String(c.cantidad) : "",
        unidad: c.unidad,
        precioUnitario:
          c.precioUnitario != null ? String(c.precioUnitario) : "",
        origen: c.origen,
      }));
    setEditarHistorial(filas);
    setEditarError(null);
  };

  const cerrarEditar = () => {
    setEditarItem(null);
    setEditarError(null);
  };

  const actualizarFilaHistorialEditar = (
    id: string,
    patch: Partial<FilaHistorialEditable>,
  ) => {
    setEditarHistorial((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  };

  const borrarFilaHistorialEditar = async (fila: FilaHistorialEditable) => {
    const ok = await confirmar({
      titulo: `¿Borrar la compra del ${formatearFechaCorta(fila.fecha)}?`,
      texto: "Se borra del historial y no se puede deshacer.",
      confirmar: "Borrar compra",
      peligro: true,
    });
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
      setEditarError(
        err instanceof Error ? err.message : "No se pudo borrar la compra.",
      );
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
        setEditarError(
          `Cantidad inválida en la compra del ${formatearFechaCorta(fila.fecha)}.`,
        );
        return;
      }
      if (
        fila.precioUnitario.trim() &&
        parseCantidad(fila.precioUnitario) == null
      ) {
        setEditarError(
          `Precio inválido en la compra del ${formatearFechaCorta(fila.fecha)}.`,
        );
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
      if (proveedorFinal !== editarItem.proveedor)
        patchItem.proveedor = proveedorFinal;
      if (editarRubro !== editarItem.rubro) patchItem.rubro = editarRubro;
      if (editarUnidad !== editarItem.unidadCompra)
        patchItem.unidad_compra = editarUnidad;
      if (bufferRedondeado !== editarItem.bufferPct)
        patchItem.buffer_pct = bufferRedondeado;

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
        const { precioUnitario, importeTotal } = completarPrecio(
          cantidad,
          precioIngresado,
          null,
        );

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
      aviso("Cambios guardados", { tono: "exito" });
    } catch (err) {
      setEditarError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar los cambios.",
      );
    } finally {
      setEditarIsSaving(false);
    }
  };

  /** Trae el array actual de items del pedido de un proveedor. */
  const obtenerItemsPedido = async (
    proveedor: Proveedor,
  ): Promise<PedidoItemDraft[]> => {
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
    items: PedidoItemDraft[],
  ): Promise<void> => {
    const { error: upsertError } = await supabase
      .from("pedidos_proveedores")
      .upsert(
        {
          proveedor,
          items,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proveedor" },
      );
    if (upsertError) {
      throw new Error(formatPostgrestError(upsertError));
    }
  };

  const agregarAPedido = async (
    proveedor: Proveedor,
    entry: ItemConPrediccion,
  ) => {
    setAgregandoId(entry.item.id);
    setError(null);
    try {
      const itemsAnteriores = await obtenerItemsPedido(proveedor);

      const cantidadDraft = cantidades[entry.item.id];
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
        setAgregadoOkId((current) =>
          current === entry.item.id ? null : current,
        );
      }, 2200);
      anunciarDeshacer({
        tipo: "pedido",
        proveedor,
        itemsAnteriores,
        etiqueta: entry.item.nombre,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo agregar al pedido.",
      );
    } finally {
      setAgregandoId(null);
    }
  };

  const agregarLoteAPedido = async (
    proveedor: Proveedor,
    lista: ItemConPrediccion[],
  ) => {
    setAgregandoLoteProveedor(proveedor);
    setError(null);
    try {
      const itemsAnteriores = await obtenerItemsPedido(proveedor);

      const nuevos: PedidoItemDraft[] = lista.map((entry) => {
        const cantidadDraft = cantidades[entry.item.id];
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
      anunciarDeshacer({
        tipo: "pedido",
        proveedor,
        itemsAnteriores,
        etiqueta: `${nuevos.length} ítems de ${proveedor}`,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo agregar el lote al pedido.",
      );
    } finally {
      setAgregandoLoteProveedor(null);
    }
  };

  /** Guarda el snapshot para deshacer (tecla Z) y muestra el aviso con Deshacer. */
  function anunciarDeshacer(snap: SnapshotAccion) {
    setUndoAccion(snap);
    aviso(
      snap.tipo === "pedido"
        ? `${snap.etiqueta}: agregado a ${snap.proveedor}`
        : `${snap.etiqueta} registrada`,
      {
        tono: "exito",
        ms: UNDO_AGREGADO_MS,
        deshacer: () => void deshacerSnap(snap),
      },
    );
  }

  async function deshacerSnap(snap: SnapshotAccion) {
    if (deshechosRef.current.has(snap)) {
      return;
    }
    deshechosRef.current.add(snap);
    setUndoAccion((current) => (current === snap ? null : current));
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
  }

  const deshacerAccion = async () => {
    if (!undoAccion) {
      return;
    }
    await deshacerSnap(undoAccion);
  };

  const deshacerConTecla = useEffectEvent(() => {
    void deshacerAccion();
  });

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
      deshacerConTecla();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [undoAccion]);

  const renderControles = (
    proveedor: string,
    entry: ItemConPrediccion,
    urgente: boolean,
  ) => {
    const { item } = entry;
    const busy = agregandoId === item.id;
    const puedeAgregar = proveedor !== SIN_PROVEEDOR;
    const agregado = agregadoOkId === item.id;
    const borrando = borrandoId === item.id;

    return (
      <div className="flex shrink-0 items-center gap-1">
        <label className="mr-auto flex items-center gap-1.5 sm:mr-1">
          <span className="sr-only">Cantidad de {item.nombre}</span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={cantidades[item.id] ?? ""}
            disabled={busy}
            onChange={(e) =>
              setCantidadPorId((prev) => ({
                ...prev,
                [item.id]: e.target.value,
              }))
            }
            placeholder="—"
            className={cx(INPUT_FILA, "w-16 text-right")}
          />
          <span className="w-10 truncate text-[0.8rem] text-label-3">
            {item.unidadCompra}
          </span>
        </label>
        <BotonIcono
          etiqueta={`Registrar última compra de ${item.nombre}`}
          icono={<CalendarPlus className="h-5 w-5" aria-hidden />}
          onClick={() => abrirRegistrar(item)}
        />
        <BotonIcono
          etiqueta={`Editar ${item.nombre}`}
          variante="plano"
          icono={<Pencil className="h-[18px] w-[18px]" aria-hidden />}
          onClick={() => abrirEditar(item)}
          className="text-label-3"
        />
        <BotonIcono
          etiqueta={`Borrar ${item.nombre} de Stock`}
          variante="plano"
          disabled={borrando}
          icono={
            borrando ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
            )
          }
          onClick={() => void abrirBorrar(item)}
          className="text-label-3 hover:text-danger"
        />
        <button
          type="button"
          disabled={busy || !puedeAgregar}
          onClick={() => {
            vibrar();
            void agregarAPedido(item.proveedor as Proveedor, entry);
          }}
          aria-label={`Agregar ${item.nombre} al pedido`}
          title={
            puedeAgregar
              ? `Agregar al pedido de ${proveedor}`
              : "Asigná un proveedor en /stock para poder agregarlo a un pedido"
          }
          className={cx(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40",
            agregado
              ? "bg-success text-[#fff]"
              : urgente
                ? "bg-success-soft text-success"
                : "bg-fill text-label",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : agregado ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <Plus className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>
    );
  };

  const CLASE_FILA_ITEM =
    "flex flex-col gap-2 border-b border-separator py-3 pl-4 pr-2 last:border-0 sm:flex-row sm:items-center sm:gap-3";

  /** Botón de texto dentro de una línea de detalle (área tocable agrandada). */
  const CLASE_LINK_DETALLE =
    "-my-3 py-3 font-medium text-info underline decoration-dotted underline-offset-2";

  const renderFilaCompacta = (proveedor: string, entry: ItemConPrediccion) => {
    const { item, prediccion } = entry;
    const ultimoPrecio = ultimoPrecioPorItem.get(item.id);

    return (
      <li key={item.id} className={CLASE_FILA_ITEM}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[1rem] font-medium leading-snug text-label">
              {item.nombre}
            </span>
            <EstadoBadge estado={prediccion.estado} />
          </div>
          <p className="mt-0.5 text-[0.86rem] leading-snug text-label-3">
            {prediccion.diasParaProxima != null ? (
              prediccion.diasParaProxima <= 0 ? (
                <span className="font-medium text-danger">
                  Atrasado {Math.abs(prediccion.diasParaProxima)} día
                  {Math.abs(prediccion.diasParaProxima) === 1 ? "" : "s"}
                </span>
              ) : (
                <>
                  En {prediccion.diasParaProxima} día
                  {prediccion.diasParaProxima === 1 ? "" : "s"}
                </>
              )
            ) : (
              "Sin historial suficiente"
            )}
            {prediccion.esEstimado ? (
              <span className="text-info"> (estimado)</span>
            ) : null}
            {ultimoPrecio != null ? (
              <span className="tabular-nums">
                {" "}
                · {formatearPrecioUnitario(ultimoPrecio, item.unidadCompra)}
              </span>
            ) : null}
          </p>
        </div>
        {renderControles(proveedor, entry, true)}
      </li>
    );
  };

  const renderFilaAlDia = (proveedor: string, entry: ItemConPrediccion) => {
    const { item, prediccion } = entry;
    const ultimoPrecio = ultimoPrecioPorItem.get(item.id);

    return (
      <li key={item.id} className={CLASE_FILA_ITEM}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[1rem] font-medium leading-snug text-label">
              {item.nombre}
            </span>
            <EstadoBadge estado={prediccion.estado} />
          </div>
          <p className="mt-0.5 text-[0.86rem] leading-snug text-label-3">
            {prediccion.ultimaCompra ? (
              <>
                Última compra: {prediccion.ultimaCompra}
                {prediccion.intervaloTipicoDias != null ? (
                  <>
                    {" "}
                    · Ciclo {prediccion.esEstimado
                      ? "estimado"
                      : "típico"}: {prediccion.intervaloTipicoDias} días
                    {prediccion.esEstimado ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => abrirFrecuencia(item)}
                          className={CLASE_LINK_DETALLE}
                        >
                          editar
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-info">
                      Registrá otra fecha o{" "}
                      <button
                        type="button"
                        onClick={() => abrirFrecuencia(item)}
                        className={CLASE_LINK_DETALLE}
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
              <span className="text-info">
                Sin compras registradas todavía. Tocá el calendario para cargar
                la última.
              </span>
            )}
            {ultimoPrecio != null ? (
              <span className="tabular-nums">
                {" "}
                · {formatearPrecioUnitario(ultimoPrecio, item.unidadCompra)}
              </span>
            ) : null}
          </p>
        </div>
        {renderControles(proveedor, entry, false)}
      </li>
    );
  };

  /** Tarjeta de un proveedor: encabezado plegable (+ "Agregar los N") y sus ítems. */
  const renderGrupo = (
    seccion: "urgentes" | "alDia" | "sinDatos",
    proveedor: string,
    lista: ItemConPrediccion[],
  ) => {
    const clave = `${seccion}:${proveedor}`;
    const colapsado = gruposColapsados.has(clave);
    const conLote = seccion === "urgentes" && proveedor !== SIN_PROVEEDOR;
    const render =
      seccion === "urgentes" ? renderFilaCompacta : renderFilaAlDia;
    return (
      <div key={proveedor} className={LISTA_AGRUPADA}>
        <div
          className={cx(
            "flex min-h-14 items-center gap-1 px-2",
            !colapsado && "border-b border-separator",
          )}
        >
          <button
            type="button"
            aria-expanded={!colapsado}
            onClick={() => {
              vibrar();
              toggleGrupo(clave);
            }}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left transition active:bg-fill"
          >
            {colapsado ? (
              <ChevronRight
                className="h-[18px] w-[18px] shrink-0 text-label-3"
                aria-hidden
              />
            ) : (
              <ChevronDown
                className="h-[18px] w-[18px] shrink-0 text-label-3"
                aria-hidden
              />
            )}
            <span className="truncate text-[1rem] font-semibold text-label">
              {proveedor}
            </span>
            <span className="shrink-0 text-[0.9rem] tabular-nums text-label-3">
              {lista.length}
            </span>
          </button>
          {conLote ? (
            <Boton
              variante="terciario"
              cargando={agregandoLoteProveedor === proveedor}
              icono={<Layers className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() =>
                void agregarLoteAPedido(proveedor as Proveedor, lista)
              }
              className="shrink-0 px-3"
            >
              Agregar los {lista.length}
              <span className="hidden sm:inline"> al pedido</span>
            </Boton>
          ) : null}
        </div>
        {!colapsado ? (
          <ul>{lista.map((entry) => render(proveedor, entry))}</ul>
        ) : null}
      </div>
    );
  };

  const nItemsActivos = itemsConPrediccion.length;
  const nLineasImport = importLineasPreview.length;

  return (
    <Pantalla
      titulo="Compras"
      ancho="amplio"
      subtitulo={
        isLoading
          ? "Cargando…"
          : nItemsActivos === 0
            ? "Sin ítems activos"
            : totalUrgentes > 0
              ? `${totalUrgentes} para pedir · ${nItemsActivos} ítems`
              : `Nada urgente · ${nItemsActivos} ítems`
      }
      ayuda={
        <>
          <p>
            Cada cuánto conviene volver a pedir cada ítem de{" "}
            <strong className="text-label">Stock</strong>, según el historial
            real de compras. No hay conteo de stock: el margen de seguridad
            (buffer) adelanta el aviso antes de que se acabe.
          </p>
          <p>
            En cada ítem: la cantidad a pedir, el calendario para registrar a
            mano la última compra, y <strong className="text-label">+</strong>{" "}
            para agregarlo al pedido del proveedor (se puede deshacer). El lápiz
            edita el ítem y sus compras; el tacho lo borra de Stock.
          </p>
          <p>
            Con <strong className="text-label">Importar albarán</strong> pegás
            las líneas de un albarán y se cargan todas las compras juntas.
          </p>
          <p>
            En la compu: <strong className="text-label">U</strong> alterna Solo
            urgentes y <strong className="text-label">Z</strong> deshace lo
            último que agregaste o registraste.
          </p>
        </>
      }
      acciones={
        <Boton
          variante="secundario"
          icono={<ListPlus className="h-[18px] w-[18px]" aria-hidden />}
          onClick={() => abrirImport()}
          aria-label="Importar albarán"
        >
          <span className="sm:hidden">Albarán</span>
          <span className="hidden sm:inline">Importar albarán</span>
        </Boton>
      }
    >
      {error ? <Alerta className="mb-4">{error}</Alerta> : null}

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : (
        <>
          <div className="space-y-1">
            <div className="relative">
              <Campo
                ref={buscadorRef}
                type="text"
                enterKeyHint="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar ítem"
                aria-label="Buscar ítem"
                autoComplete="off"
                icono={<Search className="h-[18px] w-[18px]" aria-hidden />}
                className={busqueda ? "pr-12" : undefined}
              />
              {busqueda ? (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-0.5 top-0.5 inline-flex size-11 items-center justify-center rounded-full text-label-3 transition active:bg-fill"
                >
                  <X className="h-[18px] w-[18px]" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 pl-1">
              <div className="flex items-center gap-3">
                <Interruptor
                  activo={soloUrgentes}
                  onChange={setSoloUrgentes}
                  etiqueta="Solo urgentes"
                />
                <span className="text-[0.94rem] text-label-2">
                  Solo urgentes
                </span>
                <kbd className="hidden rounded-md bg-fill px-1.5 py-0.5 font-sans text-[0.8rem] text-label-3 sm:inline">
                  U
                </kbd>
              </div>
              {!soloUrgentes ? (
                <Boton
                  variante="terciario"
                  onClick={alternarExpandirTodo}
                  icono={
                    todoExpandido ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    )
                  }
                  className="px-2"
                >
                  {todoExpandido ? "Colapsar todo" : "Expandir todo"}
                </Boton>
              ) : null}
            </div>
          </div>

          {!soloUrgentes ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <KpiCard
                icono={<AlertTriangle className="h-4 w-4" aria-hidden />}
                titulo="Atrasados"
                valor={kpis.Atrasado}
                tono="text-danger"
              />
              <KpiCard
                icono={<CalendarClock className="h-4 w-4" aria-hidden />}
                titulo="Pedir pronto"
                valor={kpis["Pedir pronto"]}
                tono="text-warning"
              />
              <KpiCard
                icono={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                titulo="OK"
                valor={kpis.OK}
                tono="text-success"
              />
              <KpiCard
                icono={<HelpCircle className="h-4 w-4" aria-hidden />}
                titulo="Sin datos"
                valor={kpis["Sin datos"]}
                tono="text-info"
                onClick={
                  kpis["Sin datos"] > 0
                    ? () => {
                        setSoloUrgentes(false);
                        setSinDatosExpandido(true);
                        window.requestAnimationFrame(() => {
                          document
                            .getElementById("compras-sin-datos")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        });
                      }
                    : undefined
                }
              />
              <KpiCard
                icono={<TrendingUp className="h-4 w-4" aria-hidden />}
                titulo="Subidas 90 días"
                valor={subidasRecientes}
                tono="text-accent"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          ) : null}

          {cambiosPrecioVisibles.length > 0 ? (
            <Seccion
              titulo={
                <TituloPlegable
                  abierto={cambiosPrecioExpandido}
                  onToggle={() => setCambiosPrecioExpandido((v) => !v)}
                >
                  Cambios de precio · {cambiosPrecio.length}
                </TituloPlegable>
              }
              accion={
                subidasRecientes > 0 ? (
                  <Etiqueta
                    tono="acento"
                    icono={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
                  >
                    {subidasRecientes} subidas · 90 días
                  </Etiqueta>
                ) : null
              }
              pie={
                cambiosPrecioExpandido
                  ? "Precio por kg, caja o unidad entre albaranes seguidos del mismo ítem y proveedor. Solo se muestran variaciones de 0,5 % o 2 céntimos o más."
                  : undefined
              }
            >
              {cambiosPrecioExpandido ? (
                <div className={cx(LISTA_AGRUPADA, "max-h-96 overflow-y-auto")}>
                  <ul className="sm:hidden">
                    {cambiosPrecio.map((c, i) => (
                      <li
                        key={`${c.fecha}-${c.nombre}-${c.proveedor}-${i}`}
                        className="border-b border-separator px-4 py-3 last:border-0"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-[1rem] font-medium text-label">
                            {c.nombre}
                          </span>
                          <VariacionPrecio pct={c.variacionPct} />
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[0.86rem] text-label-3">
                          <span className="min-w-0 truncate">
                            {formatearFechaCorta(c.fecha)} ·{" "}
                            {c.proveedor ?? "—"}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                            {formatearPrecioUnitario(
                              c.precioAnterior,
                              c.unidad,
                            )}
                            <ArrowRight
                              className="h-3.5 w-3.5"
                              aria-label="pasó a"
                            />
                            <span className="text-label">
                              {formatearPrecioUnitario(c.precioNuevo, c.unidad)}
                            </span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <table className="hidden w-full text-left text-[0.94rem] sm:table">
                    <thead className="sticky top-0 bg-surface-3 text-[0.8rem] uppercase tracking-[0.07em] text-label-3">
                      <tr className="border-b border-separator">
                        <th className="px-4 py-2.5 font-semibold">Fecha</th>
                        <th className="px-4 py-2.5 font-semibold">Ítem</th>
                        <th className="px-4 py-2.5 font-semibold">Proveedor</th>
                        <th className="px-4 py-2.5 text-right font-semibold">
                          Antes
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold">
                          Ahora
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold">
                          Cambio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cambiosPrecio.map((c, i) => (
                        <tr
                          key={`${c.fecha}-${c.nombre}-${c.proveedor}-${i}`}
                          className="border-b border-separator last:border-0"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-label-2">
                            {formatearFechaCorta(c.fecha)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-label">
                            {c.nombre}
                          </td>
                          <td className="px-4 py-2.5 text-label-2">
                            {c.proveedor ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-label-2">
                            {formatearPrecioUnitario(
                              c.precioAnterior,
                              c.unidad,
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-label">
                            {formatearPrecioUnitario(c.precioNuevo, c.unidad)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <VariacionPrecio pct={c.variacionPct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Seccion>
          ) : null}

          {nItemsActivos === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<ListPlus className="h-6 w-6" aria-hidden />}
                titulo="Todavía no hay ítems para predecir"
                texto="Cargá el catálogo en Stock e importá algún albarán acá para empezar."
                accion={
                  <Boton
                    icono={
                      <ListPlus className="h-[18px] w-[18px]" aria-hidden />
                    }
                    onClick={() => abrirImport()}
                  >
                    Importar albarán
                  </Boton>
                }
              />
            </div>
          ) : hayBusqueda &&
            urgentesPorProveedor.length === 0 &&
            alDiaPorProveedor.length === 0 &&
            sinDatosPorProveedor.length === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<Search className="h-6 w-6" aria-hidden />}
                titulo="Sin resultados"
                texto={`Ningún ítem coincide con «${busqueda}».`}
              />
            </div>
          ) : (
            <>
              {totalUrgentes === 0 && !hayBusqueda ? (
                <div
                  role="status"
                  className="mt-6 flex gap-3 rounded-card bg-success-soft px-4 py-3 text-success"
                >
                  <CircleCheck
                    className="mt-0.5 h-[18px] w-[18px] shrink-0"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.94rem] font-semibold">
                      Nada urgente para pedir.
                    </p>
                    {soloUrgentes && (kpis.OK > 0 || kpis["Sin datos"] > 0) ? (
                      <p className="mt-0.5 text-[0.86rem] text-label-2">
                        Desactivá{" "}
                        <strong className="text-label">Solo urgentes</strong>{" "}
                        para ver {kpis.OK + kpis["Sin datos"]} ítem
                        {kpis.OK + kpis["Sin datos"] === 1 ? "" : "s"} al día.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {urgentesPorProveedor.length > 0 ? (
                <Seccion
                  titulo={
                    <span className="inline-flex items-center gap-1.5 text-accent">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                      Para pedir · {totalUrgentes}
                    </span>
                  }
                >
                  <div className="space-y-3">
                    {urgentesPorProveedor.map(([proveedor, lista]) =>
                      renderGrupo("urgentes", proveedor, lista),
                    )}
                  </div>
                </Seccion>
              ) : null}

              {!soloUrgentes && alDiaPorProveedor.length > 0 ? (
                <Seccion
                  titulo={
                    <TituloPlegable
                      abierto={alDiaExpandido || hayBusqueda}
                      onToggle={() => setAlDiaExpandido((v) => !v)}
                    >
                      Al día · {kpis.OK}
                    </TituloPlegable>
                  }
                >
                  {alDiaExpandido || hayBusqueda ? (
                    <div className="space-y-3">
                      {alDiaPorProveedor.map(([proveedor, lista]) =>
                        renderGrupo("alDia", proveedor, lista),
                      )}
                    </div>
                  ) : null}
                </Seccion>
              ) : null}

              {!soloUrgentes && sinDatosPorProveedor.length > 0 ? (
                <div id="compras-sin-datos" className="scroll-mt-16">
                  <Seccion
                    titulo={
                      <TituloPlegable
                        abierto={sinDatosExpandido || hayBusqueda}
                        onToggle={() => setSinDatosExpandido((v) => !v)}
                      >
                        Sin datos · {kpis["Sin datos"]}
                      </TituloPlegable>
                    }
                  >
                    {sinDatosExpandido || hayBusqueda ? (
                      <>
                        <p className="mb-3 px-1 text-[0.86rem] leading-snug text-label-2">
                          Sin albarán todavía. Tocá el calendario{" "}
                          <CalendarPlus
                            className="inline h-4 w-4 align-[-3px] text-label-3"
                            aria-hidden
                          />{" "}
                          para cargar a mano cuándo y cuánto se compró: con 2
                          fechas ya se estima el ciclo y el ítem pasa a Al día o
                          Para pedir.
                        </p>
                        <div className="space-y-3">
                          {sinDatosPorProveedor.map(([proveedor, lista]) =>
                            renderGrupo("sinDatos", proveedor, lista),
                          )}
                        </div>
                      </>
                    ) : null}
                  </Seccion>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      {/* ---------- Importar albarán ---------- */}
      <Hoja
        abierta={importAbierto}
        onCerrar={cerrarImport}
        titulo="Importar albarán"
        alto="alta"
      >
        <div className="space-y-4">
          <p className="px-1 text-[0.9rem] leading-snug text-label-2">
            Elegí proveedor y fecha, y pegá las líneas del albarán. Los ítems
            que no estén en Stock se crean solos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selector
              label="Proveedor"
              titulo="Proveedor del albarán"
              valor={importProveedor || null}
              opciones={proveedores.map((p) => ({ valor: p, label: p }))}
              onChange={(v) => setImportProveedor(v)}
              buscar={proveedores.length > 10}
            />
            <Fecha
              label="Fecha del albarán"
              valor={importFecha}
              onChange={setImportFecha}
            />
          </div>
          <div>
            <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
              Unidad por defecto
            </p>
            <Segmentado
              etiqueta="Unidad por defecto"
              valor={importUnidadDefault}
              opciones={UNIDADES.map((u) => ({ valor: u, label: u }))}
              onChange={setImportUnidadDefault}
            />
          </div>
          <div>
            <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
              El precio (4.ª columna) es
            </p>
            <Segmentado
              etiqueta="El precio de la 4.ª columna es"
              valor={importTipoPrecio}
              opciones={[
                { valor: "unitario", label: "Precio unitario" },
                { valor: "total", label: "Total de la línea" },
              ]}
              onChange={setImportTipoPrecio}
            />
          </div>
          <AreaTexto
            label="Líneas del albarán"
            value={importTexto}
            onChange={(e) => setImportTexto(e.target.value)}
            rows={8}
            spellCheck={false}
            className="resize-y font-mono text-[0.9rem]"
            placeholder={`Salmón: 8 Kilo\nAtún: 5 Kilo\nAguacate | 2 | Caja | 12.50`}
            ayuda="El precio (opcional) solo se reconoce con «nombre | cantidad | unidad | precio» o separado por tabs."
          />
          {importError ? <Alerta>{importError}</Alerta> : null}
          <div>
            <p className="mb-1.5 px-1 text-[0.86rem] text-label-2">
              <strong className="font-semibold tabular-nums text-label">
                {nLineasImport}
              </strong>{" "}
              {nLineasImport === 1 ? "línea reconocida" : "líneas reconocidas"}
            </p>
            {nLineasImport > 0 ? (
              <ul className="max-h-64 overflow-y-auto rounded-card bg-surface-3">
                {importLineasPreview.slice(0, 20).map((l, i) => (
                  <li
                    key={i}
                    className="flex min-h-11 items-center gap-2 border-b border-separator px-3 py-2 text-[0.9rem] last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-label">{l.item}</span>
                      <span className="text-label-3">
                        {" "}
                        · {l.cantidad || "—"} {l.unidad}
                        {l.precio ? ` · ${l.precio} €` : ""}
                      </span>
                    </span>
                    {l.existente ? (
                      <Etiqueta tono="exito">Vinculado</Etiqueta>
                    ) : (
                      <Etiqueta tono="alerta">Nuevo en Stock</Etiqueta>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {nLineasImport > 20 ? (
              <p className="mt-1.5 px-1 text-[0.82rem] text-label-3">
                … y {nLineasImport - 20} más
              </p>
            ) : null}
          </div>
          <PieHoja>
            <Boton variante="secundario" onClick={cerrarImport}>
              Cancelar
            </Boton>
            <Boton
              cargando={importIsSaving}
              disabled={nLineasImport === 0}
              onClick={() => void confirmarImport()}
            >
              {nLineasImport > 0
                ? `Importar ${nLineasImport} ${nLineasImport === 1 ? "línea" : "líneas"}`
                : "Importar"}
            </Boton>
          </PieHoja>
        </div>
      </Hoja>

      {/* ---------- Registrar última compra ---------- */}
      <Hoja
        abierta={registrarItem !== null}
        onCerrar={cerrarRegistrar}
        titulo="Registrar última compra"
      >
        {registrarItem ? (
          <div className="space-y-4">
            <p className="px-1 text-[0.9rem] leading-snug text-label-2">
              <strong className="text-label">{registrarItem.nombre}</strong>,
              sin albarán: cuánto y cuándo se compró por última vez, para que la
              predicción tenga con qué calcular.
            </p>
            <Fecha
              label="Fecha de la compra"
              valor={registrarFecha}
              onChange={setRegistrarFecha}
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label={`Cantidad (${registrarItem.unidadCompra})`}
                inputMode="decimal"
                value={registrarCantidad}
                onChange={(e) => setRegistrarCantidad(e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
              <Campo
                label="Precio (opcional)"
                inputMode="decimal"
                value={registrarPrecio}
                onChange={(e) => setRegistrarPrecio(e.target.value)}
                placeholder="0,00"
                className="tabular-nums"
              />
            </div>
            <div
              aria-disabled={!registrarPrecio.trim() || undefined}
              className={cx(
                !registrarPrecio.trim() && "pointer-events-none opacity-50",
              )}
            >
              <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
                Ese precio es
              </p>
              <Segmentado
                etiqueta="Ese precio es"
                valor={registrarTipoPrecio}
                opciones={[
                  { valor: "unitario", label: "Precio unitario" },
                  { valor: "total", label: "Total de la compra" },
                ]}
                onChange={setRegistrarTipoPrecio}
              />
            </div>
            <Campo
              label="Cada cuántos días se repite (opcional)"
              inputMode="numeric"
              value={registrarFrecuencia}
              onChange={(e) => setRegistrarFrecuencia(e.target.value)}
              placeholder="Ej: 30"
              className="tabular-nums"
              ayuda="Solo hace falta si es la primera compra que cargás de este ítem: con tu estimación ya se calcula la urgencia, sin esperar a una 2.ª compra."
            />
            {registrarError ? <Alerta>{registrarError}</Alerta> : null}
            <PieHoja>
              <Boton variante="secundario" onClick={cerrarRegistrar}>
                Cancelar
              </Boton>
              <Boton
                cargando={registrarIsSaving}
                onClick={() => void confirmarRegistrar()}
              >
                Guardar
              </Boton>
            </PieHoja>
          </div>
        ) : null}
      </Hoja>

      {/* ---------- Frecuencia estimada ---------- */}
      <Hoja
        abierta={frecuenciaItem !== null}
        onCerrar={cerrarFrecuencia}
        titulo="Frecuencia estimada"
      >
        {frecuenciaItem ? (
          <div className="space-y-4">
            <p className="px-1 text-[0.9rem] leading-snug text-label-2">
              Cada cuántos días aprox. volvés a comprar{" "}
              <strong className="text-label">{frecuenciaItem.nombre}</strong>.
              Con esto se calcula la urgencia aunque tenga una sola compra
              registrada.
            </p>
            <Campo
              label="Días aprox."
              inputMode="numeric"
              enterKeyHint="done"
              value={frecuenciaValor}
              onChange={(e) => setFrecuenciaValor(e.target.value)}
              placeholder="Ej: 30"
              className="tabular-nums"
              ayuda="Dejalo vacío para borrar la estimación (vuelve a Sin datos hasta la próxima compra real)."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmarFrecuencia();
                }
              }}
            />
            {frecuenciaError ? <Alerta>{frecuenciaError}</Alerta> : null}
            <PieHoja>
              <Boton variante="secundario" onClick={cerrarFrecuencia}>
                Cancelar
              </Boton>
              <Boton
                cargando={frecuenciaIsSaving}
                onClick={() => void confirmarFrecuencia()}
              >
                Guardar
              </Boton>
            </PieHoja>
          </div>
        ) : null}
      </Hoja>

      {/* ---------- Editar ítem ---------- */}
      <Hoja
        abierta={editarItem !== null}
        onCerrar={cerrarEditar}
        titulo="Editar ítem"
        alto="alta"
      >
        {editarItem ? (
          <div className="space-y-4">
            <Campo
              label="Nombre"
              value={editarNombre}
              onChange={(e) => setEditarNombre(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Selector
                label="Proveedor"
                valor={editarProveedor}
                opciones={[
                  { valor: "", label: "Sin proveedor" },
                  ...proveedores.map((p) => ({ valor: p, label: p })),
                ]}
                onChange={(v) => setEditarProveedor(v as Proveedor | "")}
                buscar={proveedores.length > 10}
              />
              <Selector
                label="Rubro"
                valor={editarRubro}
                opciones={RUBROS_INGREDIENTE.map((r) => ({
                  valor: r,
                  label: r,
                }))}
                onChange={(v) => setEditarRubro(normalizarRubro(v))}
              />
              <Selector
                label="Unidad"
                valor={editarUnidad}
                opciones={UNIDADES.map((u) => ({ valor: u, label: u }))}
                onChange={(v) => setEditarUnidad(v)}
              />
              <Campo
                label="Buffer %"
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                value={editarBuffer}
                onChange={(e) => setEditarBuffer(e.target.value)}
                className="tabular-nums"
              />
            </div>

            <Seccion
              titulo={`Historial de compras${
                editarHistorial.length > 0 ? ` · ${editarHistorial.length}` : ""
              }`}
              pie="Corregí cantidades o precios mal cargados (importación o carga a mano)."
            >
              {editarHistorial.length === 0 ? (
                <p className="rounded-card bg-surface-3 px-4 py-4 text-[0.94rem] text-label-3">
                  Sin compras registradas todavía para este ítem.
                </p>
              ) : (
                <ul className={LISTA_AGRUPADA}>
                  {editarHistorial.map((fila) => {
                    const borrandoFila = editarBorrandoFilaId === fila.id;
                    return (
                      <li
                        key={fila.id}
                        className="border-b border-separator px-3 py-3 last:border-0"
                      >
                        <div className="flex items-end gap-1">
                          <div className="min-w-0 flex-1">
                            <Fecha
                              valor={fila.fecha}
                              onChange={(iso) =>
                                actualizarFilaHistorialEditar(fila.id, {
                                  fecha: iso,
                                })
                              }
                            />
                          </div>
                          <BotonIcono
                            etiqueta={`Borrar compra del ${formatearFechaCorta(fila.fecha)}`}
                            variante="plano"
                            disabled={borrandoFila}
                            onClick={() => void borrarFilaHistorialEditar(fila)}
                            className="text-danger"
                            icono={
                              borrandoFila ? (
                                <Loader2
                                  className="h-[18px] w-[18px] animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Trash2
                                  className="h-[18px] w-[18px]"
                                  aria-hidden
                                />
                              )
                            }
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className="min-w-0">
                            <span className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2">
                              Cantidad
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fila.cantidad}
                              onChange={(e) =>
                                actualizarFilaHistorialEditar(fila.id, {
                                  cantidad: e.target.value,
                                })
                              }
                              placeholder="Cant."
                              className={cx(
                                INPUT_FILA,
                                "h-12 w-full text-right",
                              )}
                            />
                          </label>
                          <Selector
                            label="Unidad"
                            valor={fila.unidad}
                            opciones={UNIDADES.map((u) => ({
                              valor: u,
                              label: u,
                            }))}
                            onChange={(v) =>
                              actualizarFilaHistorialEditar(fila.id, {
                                unidad: v,
                              })
                            }
                          />
                          <label className="min-w-0">
                            <span className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2">
                              Precio/u
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fila.precioUnitario}
                              onChange={(e) =>
                                actualizarFilaHistorialEditar(fila.id, {
                                  precioUnitario: e.target.value,
                                })
                              }
                              placeholder="—"
                              className={cx(
                                INPUT_FILA,
                                "h-12 w-full text-right",
                              )}
                            />
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Seccion>

            {editarError ? <Alerta>{editarError}</Alerta> : null}
            <PieHoja>
              <Boton variante="secundario" onClick={cerrarEditar}>
                Cancelar
              </Boton>
              <Boton
                cargando={editarIsSaving}
                onClick={() => void guardarEditar()}
              >
                Guardar cambios
              </Boton>
            </PieHoja>
          </div>
        ) : null}
      </Hoja>
    </Pantalla>
  );
}

/** Bloque de error (mismo estilo que Avisos). */
function Alerta(props: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cx(
        "flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger",
        props.className,
      )}
    >
      <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{props.children}</p>
    </div>
  );
}

/** Botonera fija al pie de una hoja: Cancelar + acción principal. */
function PieHoja(props: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 bg-surface-2 px-4 pb-1 pt-3">
      {props.children}
    </div>
  );
}

/** Variación porcentual de precio: sube = peligro, baja = éxito. */
function VariacionPrecio(props: { pct: number }) {
  const subio = props.pct > 0;
  const texto = `${subio ? "+" : ""}${props.pct.toLocaleString("es-ES", {
    maximumFractionDigits: 1,
  })} %`;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-end gap-1 text-[0.86rem] font-semibold tabular-nums",
        subio ? "text-danger" : "text-success",
      )}
    >
      {subio ? (
        <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {texto}
    </span>
  );
}
