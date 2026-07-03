"use client";

import { Clipboard, List, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";
import {
  PROVEEDORES,
  UNIDADES,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import { parsearLineasMasivo, type LineaParseada } from "@/src/lib/parseo-lineas";

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

const crearEstadoVacio = (): Record<(typeof PROVEEDORES)[number], PedidoItem[]> =>
  PROVEEDORES.reduce(
    (acc, proveedor) => {
      acc[proveedor] = [crearItem()];
      return acc;
    },
    {} as Record<(typeof PROVEEDORES)[number], PedidoItem[]>
  );

const cargarEstadoInicial = (): Record<(typeof PROVEEDORES)[number], PedidoItem[]> => {
  const vacio = crearEstadoVacio();
  if (typeof window === "undefined") {
    return vacio;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return vacio;
    }
    const parsed = JSON.parse(raw) as Partial<
      Record<(typeof PROVEEDORES)[number], PedidoItem[]>
    >;
    return PROVEEDORES.reduce(
      (acc, proveedor) => {
        const filas = Array.isArray(parsed?.[proveedor]) ? parsed[proveedor] : [];
        const normalizadas = filas
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
        acc[proveedor] = normalizadas.length > 0 ? normalizadas : [crearItem()];
        return acc;
      },
      {} as Record<(typeof PROVEEDORES)[number], PedidoItem[]>
    );
  } catch {
    return vacio;
  }
};

const normalizarFilas = (filas: PedidoItem[] | null | undefined): PedidoItem[] => {
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
  rows: PedidoProveedorRow[]
): Record<(typeof PROVEEDORES)[number], PedidoItem[]> => {
  return PROVEEDORES.reduce(
    (acc, proveedor) => {
      const row = rows.find((r) => r.proveedor === proveedor);
      acc[proveedor] = normalizarFilas(row?.items);
      return acc;
    },
    {} as Record<(typeof PROVEEDORES)[number], PedidoItem[]>
  );
};

const crearEditadoVacio = (): Record<Proveedor, string | null> =>
  PROVEEDORES.reduce(
    (acc, proveedor) => {
      acc[proveedor] = null;
      return acc;
    },
    {} as Record<Proveedor, string | null>
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
    const parsed = JSON.parse(raw) as Partial<Record<Proveedor, string | null>>;
    PROVEEDORES.forEach((p) => {
      if (typeof parsed[p] === "string") {
        base[p] = parsed[p] as string;
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
    {} as Record<Proveedor, VistaProveedor>
  );
  if (typeof window === "undefined") {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_VISTAS_KEY);
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<Record<Proveedor, VistaProveedor>>;
    PROVEEDORES.forEach((p) => {
      if (parsed[p] === "lista" || parsed[p] === "editable") {
        base[p] = parsed[p];
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
  filaCongelada?: { id: string; segmento: SegmentoPedido } | null
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
    (f) => f.item.trim().length > 0 && !esCantidadCeroOVacia(f.cantidad)
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

const preambleListaPedidoPorProveedor = (proveedor: Proveedor): string =>
  proveedor === "Cominport"
    ? PREAMBLE_TEXTO_LISTA_PEDIDO_COMINPORT
    : PREAMBLE_TEXTO_LISTA_PEDIDO_DEFECTO;

const textoPedidoComprimido = (
  filas: PedidoItem[]
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
  filas: PedidoItem[]
): string => {
  const preamble = preambleListaPedidoPorProveedor(proveedor);
  const { texto } = textoPedidoComprimido(filas);
  const cuerpoItems = texto.trim();
  if (!cuerpoItems) {
    return preamble.trimEnd();
  }
  return `${preamble}${texto}`;
};

function PedidoFilaEditableRow(props: {
  proveedor: Proveedor;
  fila: PedidoItem;
  actualizarFila: (
    proveedor: Proveedor,
    itemId: string,
    patch: Partial<PedidoItem>
  ) => void;
  solicitarEliminarFila: (proveedor: Proveedor, itemId: string) => void;
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
  const onEnfocarNombreConsumidoRef = useRef(onEnfocarNombreConsumido);
  onEnfocarNombreConsumidoRef.current = onEnfocarNombreConsumido;

  useEffect(() => {
    if (!enfocarNombre) {
      return;
    }
    const id = requestAnimationFrame(() => {
      itemRef.current?.focus();
      itemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      onEnfocarNombreConsumidoRef.current?.();
    });
    return () => cancelAnimationFrame(id);
  }, [enfocarNombre, fila.id]);

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2"
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
        placeholder="Item"
        className="min-w-[10rem] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
      />
      <input
        ref={cantidadRef}
        value={fila.cantidad}
        onChange={(e) =>
          actualizarFila(proveedor, fila.id, { cantidad: e.target.value })
        }
        placeholder="Cantidad"
        inputMode="decimal"
        className="w-24 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
      />
      <select
        value={fila.unidad}
        onChange={(e) =>
          actualizarFila(proveedor, fila.id, {
            unidad: e.target.value as UnidadMedida,
          })
        }
        className="w-24 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
      >
        {UNIDADES.map((unidad) => (
          <option key={unidad} value={unidad}>
            {unidad}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => solicitarEliminarFila(proveedor, fila.id)}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-2 text-zinc-500 transition hover:border-zinc-700 hover:text-red-300"
        aria-label="Eliminar fila de pedido"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PedidosPage() {
  const [pedidosPorProveedor, setPedidosPorProveedor] = useState<
    Record<(typeof PROVEEDORES)[number], PedidoItem[]>
  >(cargarEstadoInicial);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const [vistaPorProveedor, setVistaPorProveedor] =
    useState<Record<Proveedor, VistaProveedor>>(cargarVistasPorProveedor);
  const [editadoPorProveedor, setEditadoPorProveedor] =
    useState<Record<Proveedor, string | null>>(cargarEditadoPorProveedor);
  /** Fila que se está editando: queda fija en su grupo hasta perder el foco. */
  const [filaCongelada, setFilaCongelada] =
    useState<{ id: string; segmento: SegmentoPedido } | null>(null);
  const [copiadoProveedor, setCopiadoProveedor] = useState<Proveedor | null>(null);
  /** Id de fila recién añadida para enfocar el nombre (único en la página; no filtrar por proveedor). */
  const [focoFilaNuevaId, setFocoFilaNuevaId] = useState<string | null>(null);
  const [bulkProveedor, setBulkProveedor] = useState<Proveedor | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkUnidadDefault, setBulkUnidadDefault] = useState<UnidadMedida>("Unidad");
  const copiadoTimerRef = useRef<number | null>(null);
  const cargadoRemotoRef = useRef(false);
  const timerSyncRef = useRef<number | null>(null);

  useEffect(() => {
    const cargarDesdeNube = async () => {
      const { data, error } = await supabase
        .from("pedidos_proveedores")
        .select("proveedor, items, updated_at")
        .in("proveedor", [...PROVEEDORES]);

      if (error) {
        setSyncError(formatPostgrestError(error));
        cargadoRemotoRef.current = true;
        return;
      }

      const rows = (data ?? []) as PedidoProveedorRow[];
      if (rows.length > 0) {
        setPedidosPorProveedor(mergeDesdeNube(rows));
        setEditadoPorProveedor((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            if (
              PROVEEDORES.includes(r.proveedor) &&
              typeof r.updated_at === "string"
            ) {
              next[r.proveedor] = r.updated_at;
            }
          });
          return next;
        });
      }
      setSyncError(null);
      cargadoRemotoRef.current = true;
    };

    void cargarDesdeNube();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosPorProveedor));
    } catch {
      // Ignora errores de almacenamiento para no bloquear la carga de pedidos.
    }
  }, [pedidosPorProveedor]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_VISTAS_KEY, JSON.stringify(vistaPorProveedor));
    } catch {
      // Ignora.
    }
  }, [vistaPorProveedor]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_EDITADO_KEY,
        JSON.stringify(editadoPorProveedor)
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
        const payload = PROVEEDORES.map((proveedor) => ({
          proveedor,
          items: pedidosPorProveedor[proveedor],
          updated_at:
            editadoPorProveedor[proveedor] ?? new Date().toISOString(),
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
        setLastSyncLabel(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
        setIsSyncing(false);
      };
      void sync();
    }, 700);

    return () => {
      if (timerSyncRef.current) {
        window.clearTimeout(timerSyncRef.current);
      }
    };
  }, [pedidosPorProveedor]);

  const totalItemsCargados = useMemo(() => {
    return PROVEEDORES.reduce(
      (acc, proveedor) =>
        acc +
        pedidosPorProveedor[proveedor].filter((fila) => fila.item.trim().length > 0)
          .length,
      0
    );
  }, [pedidosPorProveedor]);

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
        : { id: fila.id, segmento: segmentoDeFila(fila) }
    );
  };

  const descongelarFila = () => {
    setFilaCongelada(null);
  };

  const actualizarFila = (
    proveedor: (typeof PROVEEDORES)[number],
    itemId: string,
    patch: Partial<PedidoItem>
  ) => {
    setPedidosPorProveedor((actual) => ({
      ...actual,
      [proveedor]: actual[proveedor].map((fila) =>
        fila.id === itemId ? { ...fila, ...patch } : fila
      ),
    }));
    marcarEditado(proveedor);
  };

  const agregarFila = (proveedor: (typeof PROVEEDORES)[number]) => {
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

  const quitarFila = (proveedor: (typeof PROVEEDORES)[number], itemId: string) => {
    setPedidosPorProveedor((actual) => {
      const filas = actual[proveedor];
      return {
        ...actual,
        [proveedor]: filas.length <= 1 ? [crearItem()] : filas.filter((f) => f.id !== itemId),
      };
    });
    marcarEditado(proveedor);
  };

  const solicitarEliminarFila = (
    proveedor: (typeof PROVEEDORES)[number],
    itemId: string
  ) => {
    const ok = window.confirm(
      "¿Eliminar esta línea del pedido? Si es la última fila, quedará una línea vacía para seguir cargando."
    );
    if (!ok) {
      return;
    }
    quitarFila(proveedor, itemId);
  };

  const solicitarEliminarTodasSinCantidad = (proveedor: Proveedor) => {
    const n = pedidosPorProveedor[proveedor].filter(
      (f) => f.item.trim().length > 0 && esCantidadCeroOVacia(f.cantidad)
    ).length;
    if (n === 0) {
      return;
    }
    const ok = window.confirm(
      `¿Eliminar las ${n} líneas con cantidad vacía o 0 para ${proveedor}?`
    );
    if (!ok) {
      return;
    }
    setPedidosPorProveedor((actual) => {
      const filas = actual[proveedor];
      const purgado = filas.filter(
        (f) =>
          !(f.item.trim().length > 0 && esCantidadCeroOVacia(f.cantidad))
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
    const texto = textoListaParaPortapapeles(proveedor, pedidosPorProveedor[proveedor]);
    try {
      await navigator.clipboard.writeText(texto);
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

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Pedidos</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Carga rápida por proveedor, vista Lista para copiar, y en Editar{" "}
            <span className="text-zinc-300">Agregar muchos</span> para pegar listas largas (vinos,
            sake, referencias). Las líneas sin cantidad quedan abajo para completar o borrar en
            bloque con <span className="text-zinc-300">Borrar todas</span>.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Ítems cargados: <span className="font-medium text-zinc-300">{totalItemsCargados}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isSyncing
              ? "Sincronizando con Supabase..."
              : lastSyncLabel
                ? `Sincronizado a las ${lastSyncLabel}`
                : "Sin cambios sincronizados todavía"}
          </p>
        </header>

        {syncError ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {syncError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {PROVEEDORES.map((proveedor) => {
            const { conNombreYcantidad, conNombreSinCantidad, borradorVacio } =
              segmentarFilasPedido(pedidosPorProveedor[proveedor], filaCongelada);
            const ultimaEdicion = formatearFechaEdicion(editadoPorProveedor[proveedor]);
            return (
            <section
              key={proveedor}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm uppercase tracking-[0.14em] text-zinc-400">
                    {proveedor}
                  </h2>
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
                    <button
                      type="button"
                      onClick={() => setVistaProveedor(proveedor, "editable")}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                        vistaPorProveedor[proveedor] === "editable"
                          ? "border border-zinc-500 bg-zinc-800 text-zinc-50"
                          : "border border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaProveedor(proveedor, "lista")}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                        vistaPorProveedor[proveedor] === "lista"
                          ? "border border-zinc-500 bg-zinc-800 text-zinc-50"
                          : "border border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <List className="h-3 w-3" aria-hidden />
                      Lista
                    </button>
                  </div>
                </div>
                {vistaPorProveedor[proveedor] === "editable" ? (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                    <button
                      type="button"
                      onClick={() => agregarFila(proveedor)}
                      className="inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white sm:flex-initial"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Añadir
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalBulk(proveedor)}
                      className="inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-700/60 hover:bg-emerald-900/35 sm:flex-initial"
                    >
                      <ListPlus className="h-3.5 w-3.5" aria-hidden />
                      Agregar muchos
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="-mt-1 mb-3 text-[10px] text-zinc-600">
                {ultimaEdicion
                  ? `Última edición: ${ultimaEdicion}`
                  : "Sin ediciones todavía"}
              </p>

              {vistaPorProveedor[proveedor] === "editable" ? (
                <div className="space-y-2">
                  {conNombreYcantidad.map((fila) => (
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
                  ))}
                  {conNombreSinCantidad.length > 0 ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Cantidad 0 o vacía
                        </p>
                        <button
                          type="button"
                          onClick={() => solicitarEliminarTodasSinCantidad(proveedor)}
                          className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-red-900/70 hover:bg-red-950/30 hover:text-red-300"
                        >
                          Borrar todas ({conNombreSinCantidad.length})
                        </button>
                      </div>
                      {conNombreSinCantidad.map((fila) => (
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
                      ))}
                    </>
                  ) : null}
                  {borradorVacio.map((fila) => (
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
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <section className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Mensaje
                    </h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">
                      {preambleListaPedidoPorProveedor(proveedor).trimEnd()}
                    </p>
                  </section>
                  <div className="border-t border-zinc-800/80 pt-10">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Pedido
                    </p>
                    <div className="space-y-2.5">
                      <section className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5">
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Ítems a pedir
                        </h3>
                        {conNombreYcantidad.length === 0 &&
                        conNombreSinCantidad.length === 0 ? (
                          <p className="mt-1.5 text-xs italic text-zinc-600">Sin ítems</p>
                        ) : conNombreYcantidad.length === 0 ? (
                          <p className="mt-1.5 text-xs italic text-zinc-600">
                            Nada con cantidad cargada — al copiar irá sólo el mensaje de arriba hasta que
                            cargues números
                          </p>
                        ) : (
                          <ul className="mt-1.5 list-outside list-disc space-y-0.5 pl-4 text-[13px] leading-snug marker:text-[11px] marker:text-zinc-500">
                            {conNombreYcantidad.map((fila) => (
                              <li key={fila.id} className="pl-1 text-zinc-100">
                                <span className="font-medium">{fila.item.trim()}</span>
                                <span className="text-zinc-500"> · </span>
                                <span className="tabular-nums text-zinc-200">
                                  {fila.cantidad.trim() || "—"}
                                </span>
                                <span className="text-zinc-400"> {fila.unidad}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                      {conNombreSinCantidad.length > 0 ? (
                        <section className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-3 py-2.5">
                          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Cantidad 0 o vacía
                          </h3>
                          <p className="mt-0.5 text-[11px] text-zinc-600">
                            No entran en el texto copiado. En Editar están abajo para borrarlas seguidas.
                          </p>
                          <ul className="mt-1.5 list-outside list-disc space-y-0.5 pl-4 text-[13px] leading-snug marker:text-[11px] marker:text-zinc-500">
                            {conNombreSinCantidad.map((fila) => (
                              <li key={fila.id} className="pl-1 text-zinc-400">
                                <span className="font-medium text-zinc-300">{fila.item.trim()}</span>
                                <span className="text-zinc-600"> · </span>
                                <span className="tabular-nums text-zinc-500">
                                  {fila.cantidad.trim() || "—"}
                                </span>
                                <span className="text-zinc-500"> {fila.unidad}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copiarTextoProveedor(proveedor)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
                    >
                      <Clipboard className="h-3.5 w-3.5" aria-hidden />
                      Copiar al portapapeles
                    </button>
                    {copiadoProveedor === proveedor ? (
                      <span className="text-xs text-emerald-400">Copiado</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500">
                    <span className="text-zinc-400">Copiar</span> incluye el mensaje de arriba y las
                    líneas con cantidad, en formato{" "}
                    <span className="font-mono text-[11px] text-zinc-400">
                      Ítem: cantidad unidad
                    </span>
                    . Volvé a <span className="text-zinc-400">Editar</span> para cambiar datos.
                  </p>
                </div>
              )}
            </section>
            );
          })}
        </div>

        {bulkProveedor ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarModalBulk();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-pedidos-title"
              className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(85vh,36rem)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="bulk-pedidos-title" className="text-sm font-semibold text-white">
                    Agregar muchos · {bulkProveedor}
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Una referencia por línea (solo nombre → cantidad vacía, queda en la zona de abajo
                    para completar). También{" "}
                    <span className="font-mono text-zinc-400">nombre: 6</span>,{" "}
                    <span className="font-mono text-zinc-400">nombre: 2 Caja</span> o{" "}
                    <span className="font-mono text-zinc-400">nombre | 1 | Unidad</span> / tab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarModalBulk()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                <div>
                  <label
                    htmlFor="bulk-unidad-default"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Unidad por defecto (si la línea no la indica)
                  </label>
                  <select
                    id="bulk-unidad-default"
                    value={bulkUnidadDefault}
                    onChange={(e) =>
                      setBulkUnidadDefault(e.target.value as UnidadMedida)
                    }
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
                    htmlFor="bulk-textarea"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Pegá o escribí la lista
                  </label>
                  <textarea
                    id="bulk-textarea"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={12}
                    autoFocus
                    spellCheck={false}
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                    placeholder={`Koshu Junmai 720ml\nOtros: 3\nSake nama | 2 | Unidad`}
                  />
                </div>
                <p className="text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">{lineasBulkPreview.length}</span>{" "}
                  línea(s) reconocida(s)
                  {lineasBulkPreview.length === 0 ? " — pegá al menos una línea con texto" : ""}
                </p>
                {lineasBulkPreview.length > 0 ? (
                  <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/60 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Vista previa
                    </p>
                    <ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto text-[11px] text-zinc-300">
                      {lineasBulkPreview.slice(0, 15).map((l, i) => (
                        <li key={i} className="truncate">
                          <span className="text-zinc-600">·</span>{" "}
                          <span className="font-medium text-zinc-100">{l.item}</span>
                          {l.cantidad.trim() ? (
                            <span className="text-zinc-500">
                              {" "}
                              → {l.cantidad} {l.unidad}
                            </span>
                          ) : (
                            <span className="text-zinc-600"> (sin cantidad · {l.unidad})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {lineasBulkPreview.length > 15 ? (
                      <p className="mt-1.5 text-[10px] text-zinc-600">
                        … y {lineasBulkPreview.length - 15} más
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarModalBulk()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={lineasBulkPreview.length === 0}
                  onClick={() => aplicarLineasMasivas()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  Agregar {lineasBulkPreview.length > 0 ? lineasBulkPreview.length : ""} al pedido
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
