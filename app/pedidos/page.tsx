"use client";

import {
  Check,
  ChevronDown,
  CircleAlert,
  Clipboard,
  List,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useEffectEvent } from "react";

import {
  AreaTexto,
  Boton,
  BotonIcono,
  Hoja,
  HojaOpciones,
  Pantalla,
  Segmentado,
  Selector,
  cx,
  useAvisos,
  vibrar,
} from "@/app/ui";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";
import {
  PROVEEDORES,
  UNIDADES,
  datoLegacyPorProveedor,
  fetchProveedores,
  ordenarProveedores,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import {
  parsearLineasMasivo,
  type LineaParseada,
} from "@/src/lib/parseo-lineas";
import { registrarPedidoEnviado } from "@/src/lib/pedidos-log";

type PedidoItem = {
  id: string;
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
};

type PedidoProveedorRow = {
  proveedor: Proveedor;
  items: PedidoItem[] | null;
  updated_at?: string | null;
};

const STORAGE_KEY = "omakase_pedidos_v1";
const STORAGE_VISTAS_KEY = "omakase_pedidos_vistas_v1";
const STORAGE_EDITADO_KEY = "omakase_pedidos_editado_v1";

type VistaProveedor = "editable" | "lista";

const crearItem = (): PedidoItem => ({
  id: crypto.randomUUID(),
  item: "",
  cantidad: "",
  unidad: "Unidad",
});

const crearEstadoVacio = (): Record<string, PedidoItem[]> =>
  PROVEEDORES.reduce(
    (acc, proveedor) => {
      acc[proveedor] = [crearItem()];
      return acc;
    },
    {} as Record<string, PedidoItem[]>,
  );

const cargarEstadoInicial = (): Record<string, PedidoItem[]> => {
  const vacio = crearEstadoVacio();
  if (typeof window === "undefined") {
    return vacio;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return vacio;
    }
    const parsed = JSON.parse(raw) as Partial<Record<string, PedidoItem[]>>;
    return PROVEEDORES.reduce(
      (acc, proveedor) => {
        const filasRaw = datoLegacyPorProveedor(parsed, proveedor);
        const filas = Array.isArray(filasRaw) ? filasRaw : [];
        const normalizadas = filas
          .map((fila) => {
            const unidad = UNIDADES.includes(fila.unidad)
              ? fila.unidad
              : "Unidad";
            return {
              id: fila.id || crypto.randomUUID(),
              item: typeof fila.item === "string" ? fila.item : "",
              cantidad: typeof fila.cantidad === "string" ? fila.cantidad : "",
              unidad,
            } satisfies PedidoItem;
          })
          .filter((fila) => fila.item.trim() || fila.cantidad.trim());
        acc[proveedor] = normalizadas.length > 0 ? normalizadas : [crearItem()];
        return acc;
      },
      {} as Record<string, PedidoItem[]>,
    );
  } catch {
    return vacio;
  }
};

const normalizarFilas = (
  filas: PedidoItem[] | null | undefined,
): PedidoItem[] => {
  const safe = Array.isArray(filas) ? filas : [];
  const normalizadas = safe
    .map((fila) => {
      const unidad = UNIDADES.includes(fila.unidad) ? fila.unidad : "Unidad";
      return {
        id: fila.id || crypto.randomUUID(),
        item: typeof fila.item === "string" ? fila.item : "",
        cantidad: typeof fila.cantidad === "string" ? fila.cantidad : "",
        unidad,
      } satisfies PedidoItem;
    })
    .filter((fila) => fila.item.trim() || fila.cantidad.trim());
  return normalizadas.length > 0 ? normalizadas : [crearItem()];
};

const mergeDesdeNube = (
  rows: PedidoProveedorRow[],
  lista: string[],
): Record<string, PedidoItem[]> => {
  const nombres = ordenarProveedores([
    ...lista,
    ...rows.map((r) => r.proveedor),
  ]);
  return nombres.reduce(
    (acc, proveedor) => {
      const row = rows.find((r) => r.proveedor === proveedor);
      acc[proveedor] = normalizarFilas(row?.items);
      return acc;
    },
    {} as Record<string, PedidoItem[]>,
  );
};

function expandirHuecos<T>(
  record: Record<string, T>,
  lista: string[],
  factory: () => T,
): Record<string, T> {
  const next = { ...record };
  for (const p of lista) {
    if (next[p] === undefined) {
      next[p] = factory();
    }
  }
  return next;
}

const crearEditadoVacio = (): Record<Proveedor, string | null> =>
  PROVEEDORES.reduce(
    (acc, proveedor) => {
      acc[proveedor] = null;
      return acc;
    },
    {} as Record<Proveedor, string | null>,
  );

const cargarEditadoPorProveedor = (): Record<Proveedor, string | null> => {
  const base = crearEditadoVacio();
  if (typeof window === "undefined") {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_EDITADO_KEY);
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<Record<string, string | null>>;
    PROVEEDORES.forEach((p) => {
      const valor = datoLegacyPorProveedor(parsed, p);
      if (typeof valor === "string") {
        base[p] = valor;
      }
    });
  } catch {
    // Ignorar.
  }
  return base;
};

/** Fecha + hora legible para “última edición”; null si no hay/ es inválida. */
const formatearFechaEdicion = (iso: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const cargarVistasPorProveedor = (): Record<Proveedor, VistaProveedor> => {
  const base = PROVEEDORES.reduce(
    (acc, p) => {
      acc[p] = "editable";
      return acc;
    },
    {} as Record<Proveedor, VistaProveedor>,
  );
  if (typeof window === "undefined") {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_VISTAS_KEY);
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<Record<string, VistaProveedor>>;
    PROVEEDORES.forEach((p) => {
      const valor = datoLegacyPorProveedor(parsed, p);
      if (valor === "lista" || valor === "editable") {
        base[p] = valor;
      }
    });
  } catch {
    // Ignorar.
  }
  return base;
};

/** Vacío o número que parsea a 0 (p. ej. 0, 0,00). Texto no numérico no cuenta como “cero”. */
const esCantidadCeroOVacia = (cantidad: string): boolean => {
  const t = cantidad.trim();
  if (t === "") return true;
  const n = parseFloat(t.replace(",", "."));
  return !Number.isNaN(n) && n === 0;
};

/** Quita filas totalmente vacías al final (deja al menos una si todo está vacío). */
const quitarFilasVaciasAlFinal = (filas: PedidoItem[]): PedidoItem[] => {
  const copy = [...filas];
  while (
    copy.length > 1 &&
    !copy[copy.length - 1].item.trim() &&
    !copy[copy.length - 1].cantidad.trim()
  ) {
    copy.pop();
  }
  return copy;
};

type SegmentoPedido = "conCantidad" | "sinCantidad" | "borrador";

/** A qué grupo pertenece una fila según su contenido (nombre + cantidad). */
const segmentoDeFila = (f: PedidoItem): SegmentoPedido => {
  if (!f.item.trim()) {
    return "borrador";
  }
  if (esCantidadCeroOVacia(f.cantidad)) {
    return "sinCantidad";
  }
  return "conCantidad";
};

/**
 * Reparte las filas en tres grupos. `filaCongelada` mantiene una fila en el
 * grupo que tenía al empezar a editarla, para que no “salte” mientras se tipea
 * la cantidad (se reubica recién al salir del campo).
 */
const segmentarFilasPedido = (
  filas: PedidoItem[],
  filaCongelada?: { id: string; segmento: SegmentoPedido } | null,
) => {
  const conNombreYcantidad: PedidoItem[] = [];
  const conNombreSinCantidad: PedidoItem[] = [];
  const borradorVacio: PedidoItem[] = [];
  for (const f of filas) {
    const seg =
      filaCongelada && filaCongelada.id === f.id
        ? filaCongelada.segmento
        : segmentoDeFila(f);
    if (seg === "borrador") {
      borradorVacio.push(f);
    } else if (seg === "sinCantidad") {
      conNombreSinCantidad.push(f);
    } else {
      conNombreYcantidad.push(f);
    }
  }
  return { conNombreYcantidad, conNombreSinCantidad, borradorVacio };
};

/** Solo líneas que el proveedor efectivamente lleva en el mensaje copiado. */
const filasPedidoParaCopiar = (filas: PedidoItem[]) =>
  filas.filter(
    (f) => f.item.trim().length > 0 && !esCantidadCeroOVacia(f.cantidad),
  );

/** Texto introductorio en modo Lista (mismo que se copia al portapapeles antes del listado). */
const PREAMBLE_TEXTO_LISTA_PEDIDO_DEFECTO = [
  "buenas! les pido para hoy:",
  "",
  "Para salir hoy a Alfonso X 6 chamberi.",
  "",
  "",
].join("\n");

const PREAMBLE_TEXTO_LISTA_PEDIDO_COMINPORT = [
  "Buenas! Te pido para que me entreguen el próximo día disponible.",
  "Cliente YUKU MADRID CIF: ESB56825342",
  "Entrega en ALFONSO X 6, CHAMBERÍ . ",
  "Te dejo un movil por si no hay nadie: +34 664 63 56 69",
  "",
  "",
].join("\n");

const PREAMBLE_TEXTO_LISTA_PEDIDO_NISHIKIDORI = [
  "Bonjour, je vous passe commande :",
  "Client YUKU MADRID — CIF ESB56825342",
  "Livraison : Alfonso X 6, Chamberí, 28010 Madrid",
  "Tél. si absent : +34 664 63 56 69",
  "",
  "",
].join("\n");

const preambleListaPedidoPorProveedor = (proveedor: Proveedor): string => {
  if (proveedor === "Cominport") {
    return PREAMBLE_TEXTO_LISTA_PEDIDO_COMINPORT;
  }
  if (proveedor === "Nishikidori") {
    return PREAMBLE_TEXTO_LISTA_PEDIDO_NISHIKIDORI;
  }
  return PREAMBLE_TEXTO_LISTA_PEDIDO_DEFECTO;
};

const textoPedidoComprimido = (
  filas: PedidoItem[],
): { texto: string; lineas: number } => {
  const lineasTexto = filasPedidoParaCopiar(filas).map((f) => {
    const item = f.item.trim();
    const cant = f.cantidad.trim() || "—";
    return `${item}: ${cant} ${f.unidad}`;
  });
  return {
    texto: lineasTexto.join("\n"),
    lineas: Math.max(lineasTexto.length, 1),
  };
};

/** Encabezado del mensaje + líneas del pedido (para copiar/pegar en WhatsApp u otro canal). */
const textoListaParaPortapapeles = (
  proveedor: Proveedor,
  filas: PedidoItem[],
): string => {
  const preamble = preambleListaPedidoPorProveedor(proveedor);
  const { texto } = textoPedidoComprimido(filas);
  const cuerpoItems = texto.trim();
  if (!cuerpoItems) {
    return preamble.trimEnd();
  }
  return `${preamble}${texto}`;
};

const OPCIONES_UNIDAD = UNIDADES.map((u) => ({ valor: u, label: u }));

/** Estilos compartidos de la lista agrupada y de los títulos de grupo. */
const LISTA =
  "overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";
const TITULO_GRUPO =
  "text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3";

/** Botón chico dentro de la fila que abre la hoja de unidades (en vez del select nativo). */
function SelectorUnidad(props: {
  valor: UnidadMedida;
  onChange: (unidad: UnidadMedida) => void;
}) {
  const { valor, onChange } = props;
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Unidad: ${valor}`}
        onClick={() => {
          vibrar();
          setAbierta(true);
        }}
        className="inline-flex h-11 w-[6.25rem] shrink-0 items-center justify-between gap-1 rounded-[0.65rem] bg-fill pl-3 pr-2 text-[0.94rem] text-label transition active:scale-[0.97]"
      >
        {valor}
        <ChevronDown className="h-4 w-4 text-label-3" aria-hidden />
      </button>
      <HojaOpciones
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo="Unidad"
        opciones={OPCIONES_UNIDAD}
        valor={valor}
        onElegir={onChange}
      />
    </>
  );
}

function PedidoFilaEditableRow(props: {
  proveedor: Proveedor;
  fila: PedidoItem;
  actualizarFila: (
    proveedor: Proveedor,
    itemId: string,
    patch: Partial<PedidoItem>,
  ) => void;
  solicitarEliminarFila: (
    proveedor: Proveedor,
    itemId: string,
  ) => void | Promise<void>;
  /** Añadir fila: enfoca nombre y hace scroll; se consume al aplicar. */
  enfocarNombre?: boolean;
  onEnfocarNombreConsumido?: () => void;
  /** Avisa cuando la fila toma el foco (para congelar su grupo). */
  onFilaEnfocada?: (fila: PedidoItem) => void;
  /** Avisa cuando el foco sale de la fila por completo (para reubicarla). */
  onFilaDesenfocada?: () => void;
}) {
  const {
    proveedor,
    fila,
    actualizarFila,
    solicitarEliminarFila,
    enfocarNombre,
    onEnfocarNombreConsumido,
    onFilaEnfocada,
    onFilaDesenfocada,
  } = props;
  const itemRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const alConsumirFoco = useEffectEvent(() => onEnfocarNombreConsumido?.());

  useEffect(() => {
    if (!enfocarNombre) {
      return;
    }
    const id = requestAnimationFrame(() => {
      itemRef.current?.focus();
      itemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      alConsumirFoco();
    });
    return () => cancelAnimationFrame(id);
  }, [enfocarNombre, fila.id]);

  return (
    <li
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-separator py-1.5 pl-2 pr-1.5 last:border-0 sm:flex-nowrap"
      onFocus={() => onFilaEnfocada?.(fila)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onFilaDesenfocada?.();
        }
      }}
    >
      <input
        ref={itemRef}
        value={fila.item}
        onChange={(e) =>
          actualizarFila(proveedor, fila.id, { item: e.target.value })
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            cantidadRef.current?.focus();
          }
        }}
        aria-label="Ítem"
        placeholder="Ítem"
        enterKeyHint="next"
        className="min-h-11 w-full min-w-0 rounded-[0.65rem] bg-transparent px-2 text-[1rem] text-label outline-none ring-accent/60 transition placeholder:text-label-3 focus:bg-fill focus:ring-2 sm:w-auto sm:flex-1"
      />
      <input
        ref={cantidadRef}
        value={fila.cantidad}
        onChange={(e) =>
          actualizarFila(proveedor, fila.id, { cantidad: e.target.value })
        }
        aria-label="Cantidad"
        placeholder="Cant."
        inputMode="decimal"
        className="h-11 w-[4.75rem] shrink-0 rounded-[0.65rem] bg-fill px-2 text-right font-mono text-[1.02rem] tabular-nums text-label outline-none ring-accent/60 placeholder:font-sans placeholder:text-[0.9rem] placeholder:text-label-3 focus:ring-2"
      />
      <SelectorUnidad
        valor={fila.unidad}
        onChange={(unidad) => actualizarFila(proveedor, fila.id, { unidad })}
      />
      <BotonIcono
        etiqueta="Eliminar línea"
        variante="plano"
        icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
        onClick={() => void solicitarEliminarFila(proveedor, fila.id)}
        className="ml-auto hover:text-danger"
      />
    </li>
  );
}

export default function PedidosPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([...PROVEEDORES]);
  const [pedidosPorProveedor, setPedidosPorProveedor] =
    useState<Record<string, PedidoItem[]>>(cargarEstadoInicial);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const [vistaPorProveedor, setVistaPorProveedor] = useState<
    Record<Proveedor, VistaProveedor>
  >(cargarVistasPorProveedor);
  const [editadoPorProveedor, setEditadoPorProveedor] = useState<
    Record<Proveedor, string | null>
  >(cargarEditadoPorProveedor);
  /** Fila que se está editando: queda fija en su grupo hasta perder el foco. */
  const [filaCongelada, setFilaCongelada] = useState<{
    id: string;
    segmento: SegmentoPedido;
  } | null>(null);
  const [copiadoProveedor, setCopiadoProveedor] = useState<Proveedor | null>(
    null,
  );
  /** Id de fila recién añadida para enfocar el nombre (único en la página; no filtrar por proveedor). */
  const [focoFilaNuevaId, setFocoFilaNuevaId] = useState<string | null>(null);
  const [bulkProveedor, setBulkProveedor] = useState<Proveedor | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkUnidadDefault, setBulkUnidadDefault] =
    useState<UnidadMedida>("Unidad");
  const copiadoTimerRef = useRef<number | null>(null);
  const { aviso, confirmar } = useAvisos();
  const cargadoRemotoRef = useRef(false);
  const timerSyncRef = useRef<number | null>(null);

  useEffect(() => {
    const cargarDesdeNube = async () => {
      const [remote, lista] = await Promise.all([
        supabase
          .from("pedidos_proveedores")
          .select("proveedor, items, updated_at"),
        fetchProveedores().catch(() => [...PROVEEDORES]),
      ]);

      if (remote.error) {
        setSyncError(formatPostgrestError(remote.error));
        cargadoRemotoRef.current = true;
        return;
      }

      const rows = (remote.data ?? []) as PedidoProveedorRow[];
      const listaFinal = ordenarProveedores([
        ...lista,
        ...rows.map((r) => r.proveedor),
      ]);
      setProveedores(listaFinal);
      setPedidosPorProveedor(mergeDesdeNube(rows, listaFinal));
      setVistaPorProveedor((prev) =>
        expandirHuecos(prev, listaFinal, () => "editable" as VistaProveedor),
      );
      setEditadoPorProveedor((prev) => {
        const next = expandirHuecos(prev, listaFinal, () => null);
        rows.forEach((r) => {
          if (typeof r.updated_at === "string") {
            next[r.proveedor] = r.updated_at;
          }
        });
        return next;
      });
      setSyncError(null);
      cargadoRemotoRef.current = true;
    };

    void cargarDesdeNube();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(pedidosPorProveedor),
      );
    } catch {
      // Ignora errores de almacenamiento para no bloquear la carga de pedidos.
    }
  }, [pedidosPorProveedor]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_VISTAS_KEY,
        JSON.stringify(vistaPorProveedor),
      );
    } catch {
      // Ignora.
    }
  }, [vistaPorProveedor]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_EDITADO_KEY,
        JSON.stringify(editadoPorProveedor),
      );
    } catch {
      // Ignora.
    }
  }, [editadoPorProveedor]);

  useEffect(() => {
    return () => {
      if (copiadoTimerRef.current) {
        window.clearTimeout(copiadoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!bulkProveedor) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBulkProveedor(null);
        setBulkText("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bulkProveedor]);

  // La fecha de edición se lee al sincronizar; no es un disparador de la sincronización.
  const fechaEdicion = useEffectEvent(
    (proveedor: string) => editadoPorProveedor[proveedor],
  );

  useEffect(() => {
    if (!cargadoRemotoRef.current) {
      return;
    }

    if (timerSyncRef.current) {
      window.clearTimeout(timerSyncRef.current);
    }

    timerSyncRef.current = window.setTimeout(() => {
      const sync = async () => {
        setIsSyncing(true);
        const payload = proveedores.map((proveedor) => ({
          proveedor,
          items: pedidosPorProveedor[proveedor] ?? [crearItem()],
          updated_at: fechaEdicion(proveedor) ?? new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("pedidos_proveedores")
          .upsert(payload, { onConflict: "proveedor" });

        if (error) {
          setSyncError(formatPostgrestError(error));
          setIsSyncing(false);
          return;
        }

        setSyncError(null);
        setLastSyncLabel(
          new Date().toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setIsSyncing(false);
      };
      void sync();
    }, 700);

    return () => {
      if (timerSyncRef.current) {
        window.clearTimeout(timerSyncRef.current);
      }
    };
  }, [pedidosPorProveedor, proveedores]);

  const totalItemsCargados = useMemo(() => {
    return proveedores.reduce(
      (acc, proveedor) =>
        acc +
        (pedidosPorProveedor[proveedor] ?? []).filter(
          (fila) => fila.item.trim().length > 0,
        ).length,
      0,
    );
  }, [pedidosPorProveedor, proveedores]);

  const lineasBulkPreview = useMemo(() => {
    if (!bulkProveedor) {
      return [] as LineaParseada[];
    }
    return parsearLineasMasivo(bulkText, bulkUnidadDefault);
  }, [bulkProveedor, bulkText, bulkUnidadDefault]);

  const marcarEditado = (proveedor: Proveedor) => {
    setEditadoPorProveedor((prev) => ({
      ...prev,
      [proveedor]: new Date().toISOString(),
    }));
  };

  const congelarFila = (fila: PedidoItem) => {
    setFilaCongelada((prev) =>
      prev?.id === fila.id
        ? prev
        : { id: fila.id, segmento: segmentoDeFila(fila) },
    );
  };

  const descongelarFila = () => {
    setFilaCongelada(null);
  };

  const actualizarFila = (
    proveedor: Proveedor,
    itemId: string,
    patch: Partial<PedidoItem>,
  ) => {
    setPedidosPorProveedor((actual) => ({
      ...actual,
      [proveedor]: actual[proveedor].map((fila) =>
        fila.id === itemId ? { ...fila, ...patch } : fila,
      ),
    }));
    marcarEditado(proveedor);
  };

  const agregarFila = (proveedor: Proveedor) => {
    const nuevo = crearItem();
    setPedidosPorProveedor((actual) => ({
      ...actual,
      [proveedor]: [...actual[proveedor], nuevo],
    }));
    setFocoFilaNuevaId(nuevo.id);
    marcarEditado(proveedor);
  };

  const abrirModalBulk = (proveedor: Proveedor) => {
    setBulkProveedor(proveedor);
    setBulkText("");
    setBulkUnidadDefault("Unidad");
  };

  const cerrarModalBulk = () => {
    setBulkProveedor(null);
    setBulkText("");
  };

  const aplicarLineasMasivas = () => {
    if (!bulkProveedor) {
      return;
    }
    const lineas = parsearLineasMasivo(bulkText, bulkUnidadDefault);
    const nuevos: PedidoItem[] = lineas
      .filter((l) => l.item.trim().length > 0)
      .map((l) => ({
        id: crypto.randomUUID(),
        item: l.item.trim(),
        cantidad: l.cantidad.trim(),
        unidad: l.unidad,
      }));
    if (nuevos.length === 0) {
      return;
    }
    setPedidosPorProveedor((actual) => {
      const base = quitarFilasVaciasAlFinal(actual[bulkProveedor]);
      return {
        ...actual,
        [bulkProveedor]: [...base, ...nuevos, crearItem()],
      };
    });
    marcarEditado(bulkProveedor);
    cerrarModalBulk();
  };

  const quitarFila = (proveedor: Proveedor, itemId: string) => {
    setPedidosPorProveedor((actual) => {
      const filas = actual[proveedor];
      return {
        ...actual,
        [proveedor]:
          filas.length <= 1
            ? [crearItem()]
            : filas.filter((f) => f.id !== itemId),
      };
    });
    marcarEditado(proveedor);
  };

  const solicitarEliminarFila = async (
    proveedor: Proveedor,
    itemId: string,
  ) => {
    const nombre = pedidosPorProveedor[proveedor]
      ?.find((f) => f.id === itemId)
      ?.item.trim();
    const ok = await confirmar({
      titulo: nombre ? `¿Eliminar «${nombre}»?` : "¿Eliminar esta línea?",
      texto: "Si es la última, queda una línea vacía para seguir cargando.",
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    quitarFila(proveedor, itemId);
  };

  const solicitarEliminarTodasSinCantidad = async (proveedor: Proveedor) => {
    const n = pedidosPorProveedor[proveedor].filter(
      (f) => f.item.trim().length > 0 && esCantidadCeroOVacia(f.cantidad),
    ).length;
    if (n === 0) {
      return;
    }
    const ok = await confirmar({
      titulo: `¿Borrar ${n} ${n === 1 ? "línea" : "líneas"} sin cantidad?`,
      texto: `Son las de ${proveedor} con cantidad vacía o 0.`,
      confirmar: "Borrar todas",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setPedidosPorProveedor((actual) => {
      const filas = actual[proveedor];
      const purgado = filas.filter(
        (f) => !(f.item.trim().length > 0 && esCantidadCeroOVacia(f.cantidad)),
      );
      return {
        ...actual,
        [proveedor]: purgado.length > 0 ? purgado : [crearItem()],
      };
    });
    marcarEditado(proveedor);
  };

  const setVistaProveedor = (proveedor: Proveedor, vista: VistaProveedor) => {
    setVistaPorProveedor((prev) => ({ ...prev, [proveedor]: vista }));
  };

  const copiarTextoProveedor = async (proveedor: Proveedor) => {
    const filasParaLog = filasPedidoParaCopiar(
      pedidosPorProveedor[proveedor],
    ).map((f) => ({
      item: f.item.trim(),
      cantidad: f.cantidad.trim(),
      unidad: f.unidad,
    }));
    const texto = textoListaParaPortapapeles(
      proveedor,
      pedidosPorProveedor[proveedor],
    );
    try {
      await navigator.clipboard.writeText(texto);
      void registrarPedidoEnviado(proveedor, filasParaLog);
      aviso(`Pedido de ${proveedor} copiado`, { tono: "exito" });
      setCopiadoProveedor(proveedor);
      if (copiadoTimerRef.current) {
        window.clearTimeout(copiadoTimerRef.current);
      }
      copiadoTimerRef.current = window.setTimeout(() => {
        setCopiadoProveedor(null);
        copiadoTimerRef.current = null;
      }, 2200);
    } catch {
      window.prompt("Copiá este texto manualmente:", texto);
    }
  };

  const estadoSync = isSyncing
    ? "Guardando…"
    : lastSyncLabel
      ? `Guardado ${lastSyncLabel}`
      : null;

  const renderFilas = (proveedor: Proveedor, filas: PedidoItem[]) =>
    filas.map((fila) => (
      <PedidoFilaEditableRow
        key={fila.id}
        proveedor={proveedor}
        fila={fila}
        actualizarFila={actualizarFila}
        solicitarEliminarFila={solicitarEliminarFila}
        enfocarNombre={focoFilaNuevaId === fila.id}
        onEnfocarNombreConsumido={() => setFocoFilaNuevaId(null)}
        onFilaEnfocada={congelarFila}
        onFilaDesenfocada={descongelarFila}
      />
    ));

  return (
    <Pantalla
      titulo="Pedidos"
      subtitulo={`${totalItemsCargados} ${totalItemsCargados === 1 ? "ítem" : "ítems"}${
        estadoSync ? ` · ${estadoSync}` : ""
      }`}
      ancho="amplio"
      ayuda={
        <>
          <p>Cada proveedor tiene su pedido. Los cambios se guardan solos.</p>
          <p>
            En <strong className="text-label">Editar</strong> cargás ítem,
            cantidad y unidad. Con{" "}
            <strong className="text-label">Agregar muchos</strong> pegás listas
            largas (vinos, sake, referencias).
          </p>
          <p>
            Las líneas sin cantidad (o con 0) quedan abajo para completarlas o
            borrarlas juntas con{" "}
            <strong className="text-label">Borrar todas</strong>.
          </p>
          <p>
            En <strong className="text-label">Lista</strong> ves el pedido como
            se manda. <strong className="text-label">Copiar pedido</strong>{" "}
            copia el mensaje y las líneas con cantidad, en formato{" "}
            <span className="font-mono text-[0.9rem] text-label">
              Ítem: cantidad unidad
            </span>
            .
          </p>
        </>
      }
    >
      {syncError ? (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{syncError}</p>
        </div>
      ) : null}

      <div className="mt-2 grid items-start gap-y-10 lg:grid-cols-2 lg:gap-x-8">
        {proveedores.map((proveedor) => {
          const { conNombreYcantidad, conNombreSinCantidad, borradorVacio } =
            segmentarFilasPedido(
              pedidosPorProveedor[proveedor] ?? [crearItem()],
              filaCongelada,
            );
          const ultimaEdicion = formatearFechaEdicion(
            editadoPorProveedor[proveedor],
          );
          const vista = vistaPorProveedor[proveedor] ?? "editable";
          const copiado = copiadoProveedor === proveedor;
          return (
            <section key={proveedor} className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[1.6rem] font-semibold leading-tight text-label">
                    {proveedor}
                  </h2>
                  <p className="text-[0.84rem] text-label-3">
                    <span className="tabular-nums">
                      {conNombreYcantidad.length}
                    </span>{" "}
                    a pedir ·{" "}
                    {ultimaEdicion
                      ? `editado ${ultimaEdicion}`
                      : "sin ediciones"}
                  </p>
                </div>
                <div className="w-[11.5rem] shrink-0">
                  <Segmentado
                    etiqueta={`Vista de ${proveedor}`}
                    valor={vista}
                    onChange={(v) => setVistaProveedor(proveedor, v)}
                    opciones={[
                      {
                        valor: "editable",
                        label: (
                          <>
                            <Pencil className="h-4 w-4" aria-hidden />
                            Editar
                          </>
                        ),
                      },
                      {
                        valor: "lista",
                        label: (
                          <>
                            <List className="h-4 w-4" aria-hidden />
                            Lista
                          </>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>

              {vista === "editable" ? (
                <>
                  {conNombreYcantidad.length > 0 ? (
                    <ul className={LISTA}>
                      {renderFilas(proveedor, conNombreYcantidad)}
                    </ul>
                  ) : null}

                  {conNombreSinCantidad.length > 0 ? (
                    <>
                      <div className="mb-1 mt-5 flex min-h-11 items-center justify-between gap-3 pl-1">
                        <h3 className={TITULO_GRUPO}>Sin cantidad</h3>
                        <Boton
                          variante="terciario"
                          className="-mr-2 text-danger hover:bg-danger-soft"
                          icono={<Trash2 className="h-4 w-4" aria-hidden />}
                          onClick={() =>
                            void solicitarEliminarTodasSinCantidad(proveedor)
                          }
                        >
                          Borrar todas ({conNombreSinCantidad.length})
                        </Boton>
                      </div>
                      <ul className={LISTA}>
                        {renderFilas(proveedor, conNombreSinCantidad)}
                      </ul>
                    </>
                  ) : null}

                  {borradorVacio.length > 0 ? (
                    <ul
                      className={cx(
                        LISTA,
                        (conNombreYcantidad.length > 0 ||
                          conNombreSinCantidad.length > 0) &&
                          "mt-3",
                      )}
                    >
                      {renderFilas(proveedor, borradorVacio)}
                    </ul>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Boton
                      variante="secundario"
                      icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                      onClick={() => agregarFila(proveedor)}
                    >
                      Añadir
                    </Boton>
                    <Boton
                      variante="secundario"
                      icono={
                        <ListPlus className="h-[18px] w-[18px]" aria-hidden />
                      }
                      onClick={() => abrirModalBulk(proveedor)}
                    >
                      Agregar muchos
                    </Boton>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                    <h3 className={TITULO_GRUPO}>Mensaje</h3>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[0.97rem] leading-relaxed text-label-2">
                      {preambleListaPedidoPorProveedor(proveedor).trimEnd()}
                    </p>
                  </div>

                  <div className="mb-2 mt-5 flex min-h-8 items-center px-1">
                    <h3 className={TITULO_GRUPO}>
                      Pedido · {conNombreYcantidad.length}
                    </h3>
                  </div>
                  <ul className={LISTA}>
                    {conNombreYcantidad.length === 0 ? (
                      <li className="px-4 py-4 text-[0.94rem] leading-snug text-label-3">
                        {conNombreSinCantidad.length === 0
                          ? "Sin ítems."
                          : "Nada con cantidad todavía. Si copiás, va solo el mensaje."}
                      </li>
                    ) : (
                      conNombreYcantidad.map((fila) => (
                        <li
                          key={fila.id}
                          className="flex min-h-12 items-baseline gap-3 border-b border-separator px-4 py-3 last:border-0"
                        >
                          <span className="min-w-0 flex-1 break-words text-[1.06rem] font-medium leading-snug text-label">
                            {fila.item.trim()}
                          </span>
                          <span className="shrink-0 text-right font-mono text-[1.06rem] font-semibold tabular-nums text-label">
                            {fila.cantidad.trim() || "—"}
                            <span className="ml-1.5 font-sans text-[0.88rem] font-normal text-label-2">
                              {fila.unidad}
                            </span>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>

                  {conNombreSinCantidad.length > 0 ? (
                    <>
                      <div className="mb-2 mt-5 flex min-h-8 items-center px-1">
                        <h3 className={TITULO_GRUPO}>
                          Sin cantidad · no se copian
                        </h3>
                      </div>
                      <ul className={LISTA}>
                        {conNombreSinCantidad.map((fila) => (
                          <li
                            key={fila.id}
                            className="flex min-h-11 items-baseline gap-3 border-b border-separator px-4 py-2.5 text-label-3 last:border-0"
                          >
                            <span className="min-w-0 flex-1 break-words text-[0.97rem] leading-snug">
                              {fila.item.trim()}
                            </span>
                            <span className="shrink-0 text-[0.88rem] tabular-nums">
                              {fila.cantidad.trim() || "—"} {fila.unidad}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 -mx-4 mt-4 px-4 pb-1 sm:bottom-4 sm:mx-0 sm:px-0">
                    <Boton
                      ancho
                      tamano="grande"
                      icono={
                        copiado ? (
                          <Check className="h-[18px] w-[18px]" aria-hidden />
                        ) : (
                          <Clipboard
                            className="h-[18px] w-[18px]"
                            aria-hidden
                          />
                        )
                      }
                      onClick={() => void copiarTextoProveedor(proveedor)}
                      className="shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
                    >
                      {copiado ? "Copiado" : "Copiar pedido"}
                    </Boton>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      <Hoja
        abierta={bulkProveedor !== null}
        onCerrar={cerrarModalBulk}
        titulo={`Agregar muchos · ${bulkProveedor ?? ""}`}
        alto="alta"
      >
        <div className="space-y-4">
          <p className="text-[0.92rem] leading-relaxed text-label-2">
            Una referencia por línea. Si va solo el nombre, queda sin cantidad
            para completar. También{" "}
            <span className="font-mono text-label">nombre: 6</span>,{" "}
            <span className="font-mono text-label">nombre: 2 Caja</span> o{" "}
            <span className="font-mono text-label">nombre | 1 | Unidad</span> (o
            separado por tab).
          </p>
          <Selector
            label="Unidad si la línea no la indica"
            titulo="Unidad por defecto"
            opciones={OPCIONES_UNIDAD}
            valor={bulkUnidadDefault}
            onChange={setBulkUnidadDefault}
          />
          <AreaTexto
            label="Pegá o escribí la lista"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            autoFocus
            spellCheck={false}
            className="resize-y font-mono"
            placeholder={`Koshu Junmai 720ml\nOtros: 3\nSake nama | 2 | Unidad`}
          />

          <div>
            <p className="px-1 text-[0.94rem] text-label-2">
              <span className="font-semibold tabular-nums text-label">
                {lineasBulkPreview.length}
              </span>{" "}
              {lineasBulkPreview.length === 1
                ? "línea reconocida"
                : "líneas reconocidas"}
              {lineasBulkPreview.length === 0
                ? ". Pegá al menos una línea con texto."
                : ""}
            </p>
            {lineasBulkPreview.length > 0 ? (
              <ul className={cx(LISTA, "mt-2")}>
                {lineasBulkPreview.slice(0, 15).map((l, i) => (
                  <li
                    key={i}
                    className="flex min-h-11 items-baseline gap-3 border-b border-separator px-4 py-2.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.97rem] text-label">
                      {l.item}
                    </span>
                    <span className="shrink-0 text-[0.88rem] tabular-nums text-label-3">
                      {l.cantidad.trim()
                        ? `${l.cantidad} ${l.unidad}`
                        : `sin cantidad · ${l.unidad}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {lineasBulkPreview.length > 15 ? (
              <p className="mt-2 px-1 text-[0.84rem] text-label-3">
                … y {lineasBulkPreview.length - 15} más
              </p>
            ) : null}
          </div>

          <div className="sticky bottom-0 -mx-4 -mb-[calc(env(safe-area-inset-bottom,0px)+1rem)] grid grid-cols-[auto_1fr] gap-2 border-t border-separator bg-surface-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
            <Boton variante="secundario" onClick={() => cerrarModalBulk()}>
              Cancelar
            </Boton>
            <Boton
              disabled={lineasBulkPreview.length === 0}
              onClick={() => aplicarLineasMasivas()}
            >
              Agregar{" "}
              {lineasBulkPreview.length > 0 ? lineasBulkPreview.length : ""} al
              pedido
            </Boton>
          </div>
        </div>
      </Hoja>
    </Pantalla>
  );
}
