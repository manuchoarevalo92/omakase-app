"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Loader2,
  Plus,
  StickyNote,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Interruptor,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
  cx,
  useAvisos,
  vibrar,
  type OpcionSelector,
} from "@/app/ui";

import {
  calcularPrediccionProduccion,
  compararPorUrgenciaProduccion,
  type EstadoProduccion,
  type PrediccionProduccion,
} from "@/src/lib/produccion-prediccion";
import {
  AREAS_PRODUCCION,
  cantidadSugeridaAlMarcar,
  crearPreparacion,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  formatearCantidad,
  hoyISO,
  parseCantidadInput,
  preparacionDesdeFila,
  UNIDADES_CANTIDAD,
  type AreaProduccion,
  type Preparacion,
  type PreparacionDbRow,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

const ESTADOS_URGENTES: EstadoProduccion[] = [
  "Hacer ahora",
  "Atrasado",
  "Rehacer pronto",
];

const ETIQUETA_URGENTE_CORTA: Record<EstadoProduccion, string | null> = {
  "Hacer ahora": "Ahora",
  Atrasado: "Venció",
  "Rehacer pronto": "Pronto",
  OK: null,
  "Sin datos": null,
  Inactiva: null,
};

/** Color del texto corto de urgencia en las filas de "Para hacer". */
const TEXTO_URGENTE: Record<EstadoProduccion, string> = {
  "Hacer ahora": "text-accent",
  Atrasado: "text-danger",
  "Rehacer pronto": "text-warning",
  OK: "text-label-3",
  "Sin datos": "text-label-3",
  Inactiva: "text-label-3",
};

function esUrgente(estado: EstadoProduccion): boolean {
  return ESTADOS_URGENTES.includes(estado);
}

const ESTADO_ICONO: Record<EstadoProduccion, ReactNode> = {
  "Hacer ahora": <ChefHat className="h-3.5 w-3.5" aria-hidden />,
  Atrasado: <TriangleAlert className="h-3.5 w-3.5" aria-hidden />,
  "Rehacer pronto": <CalendarClock className="h-3.5 w-3.5" aria-hidden />,
  OK: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
  "Sin datos": <CircleHelp className="h-3.5 w-3.5" aria-hidden />,
  Inactiva: <CircleHelp className="h-3.5 w-3.5" aria-hidden />,
};

const TONO_ESTADO: Record<
  EstadoProduccion,
  "acento" | "peligro" | "alerta" | "exito" | "neutro"
> = {
  "Hacer ahora": "acento",
  Atrasado: "peligro",
  "Rehacer pronto": "alerta",
  OK: "exito",
  "Sin datos": "neutro",
  Inactiva: "neutro",
};

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatearFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES_CORTOS[(m ?? 1) - 1]} ${y}`;
}

const OPCIONES_UNIDAD: OpcionSelector<UnidadCantidad>[] = UNIDADES_CANTIDAD.map(
  (u) => ({ valor: u, label: u }),
);

const SOMBRA = "shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

const INPUT_NUMERO =
  "h-11 rounded-control bg-fill px-2 text-right font-mono text-[1.02rem] tabular-nums text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2 disabled:opacity-50";

function SelectorUnidad(props: {
  valor: UnidadCantidad;
  onChange: (u: UnidadCantidad) => void;
}) {
  return (
    <div className="w-[5.75rem] shrink-0">
      <Selector
        titulo="Unidad"
        opciones={OPCIONES_UNIDAD}
        valor={props.valor}
        onChange={props.onChange}
      />
    </div>
  );
}

function KpiCard(props: {
  icono: ReactNode;
  titulo: string;
  valor: number;
  tono: string;
}) {
  const { icono, titulo, valor, tono } = props;
  return (
    <div className={cx("rounded-card bg-surface-3 p-4", SOMBRA)}>
      <div className={cx("flex items-center gap-2", tono)}>
        {icono}
        <p className="text-[0.8rem] font-semibold uppercase tracking-[0.06em]">
          {titulo}
        </p>
      </div>
      <p className="mt-2 font-mono text-[1.6rem] font-semibold tabular-nums text-label">
        {valor}
      </p>
    </div>
  );
}

function EstadoBadge(props: { estado: EstadoProduccion }) {
  const { estado } = props;
  return (
    <Etiqueta tono={TONO_ESTADO[estado]} icono={ESTADO_ICONO[estado]}>
      {estado}
    </Etiqueta>
  );
}

/**
 * Cantidad + botón "Hecho": la acción más frecuente de la pantalla, con
 * controles grandes para usar con una mano.
 */
function ControlHecho(props: {
  nombre: string;
  unidad: string;
  valor: string;
  busy: boolean;
  onCambio: (valor: string) => void;
  onHecho: () => void;
}) {
  const { nombre, unidad, valor, busy, onCambio, onHecho } = props;
  return (
    <div className="flex items-center gap-2">
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="sr-only">Cantidad de {nombre}</span>
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={valor}
          disabled={busy}
          onChange={(e) => onCambio(e.target.value)}
          className="h-12 w-20 rounded-control bg-fill px-2.5 text-right font-mono text-[1.1rem] tabular-nums text-label outline-none ring-accent/60 focus:ring-2 disabled:opacity-50"
        />
        <span className="w-7 text-[0.86rem] text-label-3">{unidad}</span>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          vibrar();
          onHecho();
        }}
        aria-label={`Marcar ${nombre} como hecho`}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control bg-success-soft px-5 text-[1rem] font-semibold text-success transition active:scale-[0.97] disabled:opacity-45 sm:flex-none"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        )}
        Hecho
      </button>
    </div>
  );
}

function FilaAjuste(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-separator py-1.5 last:border-0">
      <span className="text-[0.94rem] text-label-2">{props.label}</span>
      <div className="flex shrink-0 items-center gap-2">{props.children}</div>
    </div>
  );
}

type ItemConPrediccion = {
  prep: Preparacion;
  prediccion: PrediccionProduccion;
};

type SnapshotHecho = {
  prepId: string;
  nombre: string;
  pendiente: boolean;
  fechaUltimaProduccion: string | null;
  ultimaCantidad: number | null;
  cantidadInput: string;
};

const UNDO_HECHO_MS = 8000;

const STORAGE_AREA = "omakase-produccion-area";
const STORAGE_SOLO_URGENTES = "omakase-produccion-solo-urgentes";

function leerAreaGuardada(): AreaProduccion {
  if (typeof window === "undefined") {
    return "delivery";
  }
  try {
    const raw = localStorage.getItem(STORAGE_AREA);
    if (raw === "delivery" || raw === "barra") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "delivery";
}

function leerSoloUrgentesGuardado(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_SOLO_URGENTES) === "1";
  } catch {
    return false;
  }
}

export default function ProduccionPage() {
  const [items, setItems] = useState<Preparacion[]>([]);
  const [areaActiva, setAreaActiva] = useState<AreaProduccion>("delivery");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const { aviso, confirmar } = useAvisos();

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("7");
  const [nuevaCantidadRef, setNuevaCantidadRef] = useState("1");
  const [nuevaUnidad, setNuevaUnidad] = useState<UnidadCantidad>("L");
  const [nuevaNotas, setNuevaNotas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alDiaExpandido, setAlDiaExpandido] = useState(false);
  const [altaExpandida, setAltaExpandida] = useState(false);
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [notasAbiertas, setNotasAbiertas] = useState<Set<string>>(
    () => new Set(),
  );
  const [notasBorrador, setNotasBorrador] = useState<Record<string, string>>(
    {},
  );
  const [cantidadPorId, setCantidadPorId] = useState<Record<string, string>>(
    {},
  );
  const [undoHecho, setUndoHecho] = useState<SnapshotHecho | null>(null);
  const inputNuevoNombreRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await fetchPreparaciones());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Preferencias guardadas en el dispositivo; se leen después de hidratar.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAreaActiva(leerAreaGuardada());
      setSoloUrgentes(leerSoloUrgentesGuardado());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AREA, areaActiva);
    } catch {
      // ignore
    }
  }, [areaActiva]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SOLO_URGENTES, soloUrgentes ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soloUrgentes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** Al cambiar de área se pliegan "al día" y el alta, como antes. */
  const cambiarArea = (area: AreaProduccion) => {
    setAreaActiva(area);
    setAlDiaExpandido(false);
    setAltaExpandida(false);
  };

  useEffect(() => {
    if (altaExpandida) {
      const t = window.setTimeout(
        () => inputNuevoNombreRef.current?.focus(),
        50,
      );
      return () => window.clearTimeout(t);
    }
  }, [altaExpandida]);

  const itemsDelArea = useMemo(
    () => items.filter((prep) => prep.area === areaActiva),
    [items, areaActiva],
  );

  // Si el área no tiene preparaciones, el alta se muestra abierta.
  const altaVisible =
    altaExpandida || (itemsDelArea.length === 0 && !isLoading);

  useEffect(() => {
    if (itemsDelArea.length === 0) {
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
  }, [itemsDelArea.length]);

  // Cantidad a mostrar: lo que escribió el usuario o, si no tocó nada, la sugerida.
  const cantidades = useMemo(() => {
    const next: Record<string, string> = {};
    items.forEach((prep) => {
      next[prep.id] = String(cantidadSugeridaAlMarcar(prep));
    });
    return { ...next, ...cantidadPorId };
  }, [items, cantidadPorId]);

  const itemsConPrediccion = useMemo((): ItemConPrediccion[] => {
    return itemsDelArea.map((prep) => ({
      prep,
      prediccion: calcularPrediccionProduccion({
        seguimientoActivo: prep.seguimientoActivo,
        pendiente: prep.pendiente,
        fechaUltimaProduccion: prep.fechaUltimaProduccion,
        duracionDias: prep.duracionDias,
        cantidadReferencia: prep.cantidadReferencia,
        ultimaCantidad: prep.ultimaCantidad,
        bufferPct: prep.bufferPct,
      }),
    }));
  }, [itemsDelArea]);

  const contadoresUrgentesPorArea = useMemo(() => {
    const map: Record<AreaProduccion, number> = { delivery: 0, barra: 0 };
    items.forEach((prep) => {
      if (!prep.seguimientoActivo) {
        return;
      }
      const pred = calcularPrediccionProduccion({
        seguimientoActivo: prep.seguimientoActivo,
        pendiente: prep.pendiente,
        fechaUltimaProduccion: prep.fechaUltimaProduccion,
        duracionDias: prep.duracionDias,
        cantidadReferencia: prep.cantidadReferencia,
        ultimaCantidad: prep.ultimaCantidad,
        bufferPct: prep.bufferPct,
      });
      if (
        pred.estado === "Hacer ahora" ||
        pred.estado === "Atrasado" ||
        pred.estado === "Rehacer pronto"
      ) {
        map[prep.area] += 1;
      }
    });
    return map;
  }, [items]);

  const ordenados = useMemo(() => {
    return [...itemsConPrediccion].sort((a, b) => {
      const cmp = compararPorUrgenciaProduccion(a.prediccion, b.prediccion);
      if (cmp !== 0) {
        return cmp;
      }
      return a.prep.nombre.localeCompare(b.prep.nombre, "es");
    });
  }, [itemsConPrediccion]);

  const activos = useMemo(
    () => ordenados.filter((e) => e.prep.seguimientoActivo),
    [ordenados],
  );

  const urgentes = useMemo(
    () => activos.filter((e) => esUrgente(e.prediccion.estado)),
    [activos],
  );

  const alDia = useMemo(
    () => activos.filter((e) => !esUrgente(e.prediccion.estado)),
    [activos],
  );

  const inactivos = useMemo(
    () => ordenados.filter((e) => !e.prep.seguimientoActivo),
    [ordenados],
  );

  const kpis = useMemo(() => {
    const base = {
      "Hacer ahora": 0,
      Atrasado: 0,
      "Rehacer pronto": 0,
      OK: 0,
      "Sin datos": 0,
    } as Record<string, number>;
    activos.forEach(({ prediccion }) => {
      if (prediccion.estado in base) {
        base[prediccion.estado] += 1;
      }
    });
    return base;
  }, [activos]);

  const actualizar = async (
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Preparacion | null> => {
    setGuardandoId(id);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from("preparaciones")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new Error(formatPostgrestError(updateError));
      }

      const actualizada = preparacionDesdeFila(data as PreparacionDbRow);
      setItems((prev) => prev.map((p) => (p.id === id ? actualizada : p)));
      return actualizada;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return null;
    } finally {
      setGuardandoId(null);
    }
  };

  const deshacerHecho = useCallback(async () => {
    if (!undoHecho) {
      return;
    }
    const snap = undoHecho;
    setUndoHecho(null);
    const actualizada = await actualizar(snap.prepId, {
      pendiente: snap.pendiente,
      fecha_ultima_produccion: snap.fechaUltimaProduccion,
      ultima_cantidad: snap.ultimaCantidad,
    });
    if (actualizada) {
      setCantidadPorId((prev) => ({
        ...prev,
        [snap.prepId]: snap.cantidadInput,
      }));
    }
  }, [undoHecho]);

  /**
   * El aviso con "Deshacer" se crea al marcar hecho; este ref le da acceso al
   * deshacer vigente (y a qué preparación corresponde) sin cambiar la lógica.
   */
  const deshacerVigente = useRef<{
    prepId: string | null;
    deshacer: () => Promise<void>;
  }>({ prepId: null, deshacer: deshacerHecho });
  useEffect(() => {
    deshacerVigente.current = {
      prepId: undoHecho?.prepId ?? null,
      deshacer: deshacerHecho,
    };
  }, [undoHecho, deshacerHecho]);

  const marcarHecha = async (prep: Preparacion) => {
    const cantidad = parseCantidadInput(cantidades[prep.id] ?? "");
    if (cantidad == null) {
      setError("Indicá cuánto hiciste (cantidad mayor que 0).");
      return;
    }
    const snapshot: SnapshotHecho = {
      prepId: prep.id,
      nombre: prep.nombre,
      pendiente: prep.pendiente,
      fechaUltimaProduccion: prep.fechaUltimaProduccion,
      ultimaCantidad: prep.ultimaCantidad,
      cantidadInput: cantidades[prep.id] ?? String(cantidad),
    };
    const actualizada = await actualizar(prep.id, {
      pendiente: false,
      fecha_ultima_produccion: hoyISO(),
      ultima_cantidad: cantidad,
    });
    if (!actualizada) {
      return;
    }
    setCantidadPorId((prev) => ({ ...prev, [prep.id]: String(cantidad) }));
    setUndoHecho(snapshot);
    aviso(
      `${prep.nombre}: hecho (${formatearCantidad(cantidad, actualizada.unidadCantidad)})`,
      {
        tono: "exito",
        ms: UNDO_HECHO_MS,
        deshacer: () => {
          const vigente = deshacerVigente.current;
          if (vigente.prepId === snapshot.prepId) {
            void vigente.deshacer();
          }
        },
      },
    );
  };

  useEffect(() => {
    if (!undoHecho) {
      return;
    }
    const snap = undoHecho;
    const timer = window.setTimeout(() => {
      setUndoHecho((current) =>
        current?.prepId === snap.prepId ? null : current,
      );
    }, UNDO_HECHO_MS);

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
      void deshacerHecho();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [undoHecho, deshacerHecho]);

  const togglePendiente = async (prep: Preparacion) => {
    await actualizar(prep.id, { pendiente: !prep.pendiente });
  };

  const toggleNotas = (prep: Preparacion) => {
    setNotasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(prep.id)) {
        next.delete(prep.id);
      } else {
        next.add(prep.id);
        setNotasBorrador((b) =>
          b[prep.id] !== undefined ? b : { ...b, [prep.id]: prep.notas ?? "" },
        );
      }
      return next;
    });
  };

  const guardarNotas = (prep: Preparacion) => {
    const valor = (notasBorrador[prep.id] ?? prep.notas ?? "").trim();
    const actual = (prep.notas ?? "").trim();
    if (valor === actual) {
      return;
    }
    void actualizar(prep.id, { notas: valor || null });
  };

  const toggleSeguimiento = async (prep: Preparacion) => {
    const nuevo = !prep.seguimientoActivo;
    await actualizar(prep.id, {
      seguimiento_activo: nuevo,
      pendiente: nuevo ? prep.pendiente : false,
    });
  };

  const eliminar = async (prep: Preparacion) => {
    const ok = await confirmar({
      titulo: `¿Eliminar "${prep.nombre}"?`,
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setError(null);
    const { error: deleteError } = await supabase
      .from("preparaciones")
      .delete()
      .eq("id", prep.id);
    if (deleteError) {
      setError(formatPostgrestError(deleteError));
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== prep.id));
  };

  const onCrear = async (e: FormEvent) => {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    const duracion = parseInt(nuevaDuracion, 10);
    const cantidadRef = parseCantidadInput(nuevaCantidadRef);
    if (!nombre) {
      return;
    }
    if (!Number.isFinite(duracion) || duracion < 1) {
      setError("La duración debe ser al menos 1 día.");
      return;
    }
    if (cantidadRef == null) {
      setError("El lote típico debe ser mayor que 0.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await crearPreparacion({
        nombre,
        area: areaActiva,
        duracionDias: duracion,
        cantidadReferencia: cantidadRef,
        unidadCantidad: nuevaUnidad,
        notas: nuevaNotas.trim() || null,
      });
      setNuevoNombre("");
      setNuevaDuracion("7");
      setNuevaCantidadRef("1");
      setNuevaUnidad("L");
      setNuevaNotas("");
      setAltaExpandida(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cambiarCantidad = (id: string, valor: string) =>
    setCantidadPorId((prev) => ({ ...prev, [id]: valor }));

  const renderFilaCompacta = ({ prep, prediccion }: ItemConPrediccion) => {
    const busy = guardandoId === prep.id;
    const etiqueta = ETIQUETA_URGENTE_CORTA[prediccion.estado];

    return (
      <li
        key={prep.id}
        className="flex flex-col gap-2.5 border-b border-separator px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[1.03rem] font-medium leading-snug text-label">
            {prep.notas ? (
              <StickyNote
                className="h-4 w-4 shrink-0 text-warning"
                aria-label="Tiene notas"
              />
            ) : null}
            <span className="truncate">{prep.nombre}</span>
          </p>
          {etiqueta ? (
            <p
              className={cx(
                "mt-0.5 text-[0.8rem] font-semibold uppercase tracking-[0.06em]",
                prep.pendiente
                  ? "text-accent"
                  : TEXTO_URGENTE[prediccion.estado],
              )}
            >
              {etiqueta}
            </p>
          ) : null}
        </div>
        <ControlHecho
          nombre={prep.nombre}
          unidad={prep.unidadCantidad}
          valor={cantidades[prep.id] ?? ""}
          busy={busy}
          onCambio={(v) => cambiarCantidad(prep.id, v)}
          onHecho={() => void marcarHecha(prep)}
        />
      </li>
    );
  };

  const renderFila = ({ prep, prediccion }: ItemConPrediccion) => {
    const busy = guardandoId === prep.id;
    const loteTipico = formatearCantidad(
      prep.cantidadReferencia,
      prep.unidadCantidad,
    );
    const notasVisibles = notasAbiertas.has(prep.id);
    const notasValor = notasBorrador[prep.id] ?? prep.notas ?? "";

    return (
      <li
        key={prep.id}
        className={cx("rounded-card bg-surface-3 px-4 pb-1 pt-4", SOMBRA)}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[1.06rem] font-semibold leading-snug text-label">
                {prep.nombre}
              </h3>
              <EstadoBadge estado={prediccion.estado} />
            </div>
            <dl className="mt-2 grid gap-1 text-[0.88rem] text-label-2 sm:grid-cols-2">
              <div>
                <dt className="inline text-label-3">Lote típico </dt>
                <dd className="inline">
                  {loteTipico} → {prep.duracionDias} día
                  {prep.duracionDias === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt className="inline text-label-3">Última vez </dt>
                <dd className="inline">
                  {prep.fechaUltimaProduccion
                    ? formatearFechaCorta(prep.fechaUltimaProduccion)
                    : "—"}
                  {prep.ultimaCantidad != null
                    ? ` · ${formatearCantidad(prep.ultimaCantidad, prep.unidadCantidad)}`
                    : null}
                </dd>
              </div>
              {prediccion.duracionEfectivaDias != null &&
              prep.fechaUltimaProduccion &&
              prep.ultimaCantidad != null &&
              prep.ultimaCantidad !== prep.cantidadReferencia ? (
                <div className="sm:col-span-2">
                  <dt className="inline text-label-3">Duración estimada </dt>
                  <dd className="inline tabular-nums">
                    ~{prediccion.duracionEfectivaDias} día
                    {prediccion.duracionEfectivaDias === 1 ? "" : "s"} con el
                    último lote
                  </dd>
                </div>
              ) : null}
              {prediccion.proximaFechaSugerida &&
              prep.seguimientoActivo &&
              !prep.pendiente ? (
                <div className="sm:col-span-2">
                  <dt className="inline text-label-3">Rehacer hacia </dt>
                  <dd className="inline">
                    {formatearFechaCorta(prediccion.proximaFechaSugerida)}
                    {prediccion.diasParaProxima != null ? (
                      <span className="text-label-3">
                        {" "}
                        (
                        {prediccion.diasParaProxima <= 0
                          ? "ya toca"
                          : `en ${prediccion.diasParaProxima} día${prediccion.diasParaProxima === 1 ? "" : "s"}`}
                        )
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <BotonIcono
            etiqueta={`Eliminar ${prep.nombre}`}
            variante="plano"
            disabled={busy}
            onClick={() => void eliminar(prep)}
            className="-mr-2 -mt-2 hover:text-danger"
            icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
          />
        </div>

        {prep.seguimientoActivo ? (
          <div className="mt-3">
            <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
              Cantidad hecha
            </p>
            <ControlHecho
              nombre={prep.nombre}
              unidad={prep.unidadCantidad}
              valor={cantidades[prep.id] ?? ""}
              busy={busy}
              onCambio={(v) => cambiarCantidad(prep.id, v)}
              onHecho={() => void marcarHecha(prep)}
            />
          </div>
        ) : null}

        <div className="mt-3 border-t border-separator">
          <button
            type="button"
            onClick={() => toggleNotas(prep)}
            aria-expanded={notasVisibles}
            className="flex min-h-12 w-full items-center gap-2 text-left text-[0.94rem] text-label-2 transition active:opacity-70"
          >
            {notasVisibles ? (
              <ChevronDown
                className="h-[18px] w-[18px] shrink-0 text-label-3"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="h-[18px] w-[18px] shrink-0 text-label-3"
                aria-hidden
              />
            )}
            <StickyNote className="h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span className="shrink-0">Notas / receta</span>
            {prep.notas ? (
              <span className="min-w-0 truncate text-label-3">
                · {prep.notas.split("\n")[0].slice(0, 48)}
                {prep.notas.length > 48 ? "…" : ""}
              </span>
            ) : (
              <span className="text-label-3">· opcional</span>
            )}
          </button>
          {notasVisibles ? (
            <div className="pb-3">
              <AreaTexto
                aria-label={`Notas de ${prep.nombre}`}
                value={notasValor}
                disabled={busy}
                onChange={(e) =>
                  setNotasBorrador((prev) => ({
                    ...prev,
                    [prep.id]: e.target.value,
                  }))
                }
                onBlur={() => guardarNotas(prep)}
                placeholder="Receta, temperatura, dónde guardar, rendimiento del lote…"
                rows={4}
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-separator">
          <FilaAjuste label="Dura (lote típico)">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              aria-label={`Días que dura ${prep.nombre}`}
              value={prep.duracionDias}
              disabled={busy}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isFinite(v)) {
                  return;
                }
                setItems((prev) =>
                  prev.map((p) =>
                    p.id === prep.id ? { ...p, duracionDias: v } : p,
                  ),
                );
              }}
              onBlur={(e) => {
                const v = Math.min(
                  365,
                  Math.max(1, parseInt(e.target.value, 10) || 7),
                );
                void actualizar(prep.id, { duracion_dias: v });
              }}
              className={cx(INPUT_NUMERO, "w-16")}
            />
            <span className="w-8 text-[0.86rem] text-label-3">días</span>
          </FilaAjuste>
          <FilaAjuste label="Lote típico">
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Lote típico de ${prep.nombre}`}
              defaultValue={String(prep.cantidadReferencia)}
              disabled={busy}
              key={`${prep.id}-${prep.cantidadReferencia}`}
              onBlur={(e) => {
                const v = parseCantidadInput(e.target.value);
                if (v != null && v !== prep.cantidadReferencia) {
                  void actualizar(prep.id, { cantidad_referencia: v });
                }
              }}
              className={cx(INPUT_NUMERO, "w-16")}
            />
            <SelectorUnidad
              valor={prep.unidadCantidad}
              onChange={(u) => {
                if (busy) {
                  return;
                }
                void actualizar(prep.id, { unidad_cantidad: u });
              }}
            />
          </FilaAjuste>
          <FilaAjuste label="Seguimiento activo">
            <Interruptor
              etiqueta={`Seguimiento activo de ${prep.nombre}`}
              activo={prep.seguimientoActivo}
              onChange={() => {
                if (!busy) {
                  void toggleSeguimiento(prep);
                }
              }}
            />
          </FilaAjuste>
          {prep.seguimientoActivo ? (
            <FilaAjuste label="Hacer pronto">
              <Interruptor
                etiqueta={`Hacer pronto ${prep.nombre}`}
                activo={prep.pendiente}
                onChange={() => {
                  if (!busy) {
                    void togglePendiente(prep);
                  }
                }}
              />
            </FilaAjuste>
          ) : null}
        </div>
      </li>
    );
  };

  const etiquetaArea = ETIQUETA_AREA_PRODUCCION[areaActiva];

  const renderBloqueAlta = () =>
    altaVisible ? (
      <Seccion
        titulo={`Nueva preparación · ${etiquetaArea}`}
        accion={
          itemsDelArea.length > 0 ? (
            <Boton variante="terciario" onClick={() => setAltaExpandida(false)}>
              Cerrar
            </Boton>
          ) : null
        }
      >
        <form
          onSubmit={(e) => void onCrear(e)}
          className={cx("space-y-3 rounded-card bg-surface-3 p-4", SOMBRA)}
        >
          <Campo
            ref={inputNuevoNombreRef}
            label="Nombre"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Tosazu, Nikiri…"
            enterKeyHint="next"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Dura (días)"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={nuevaDuracion}
              onChange={(e) => setNuevaDuracion(e.target.value)}
              className="tabular-nums"
            />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Campo
                  label="Lote típico"
                  inputMode="decimal"
                  value={nuevaCantidadRef}
                  onChange={(e) => setNuevaCantidadRef(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <SelectorUnidad valor={nuevaUnidad} onChange={setNuevaUnidad} />
            </div>
          </div>
          <AreaTexto
            label="Notas / receta (opcional)"
            value={nuevaNotas}
            onChange={(e) => setNuevaNotas(e.target.value)}
            placeholder="Ingredientes, proceso, conservación…"
            rows={2}
          />
          <Boton
            type="submit"
            ancho
            tamano="grande"
            cargando={isSubmitting}
            disabled={!nuevoNombre.trim()}
            icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
          >
            Agregar
          </Boton>
        </form>
      </Seccion>
    ) : (
      <Boton
        variante="secundario"
        ancho
        tamano="grande"
        className="mt-6"
        icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
        onClick={() => setAltaExpandida(true)}
      >
        Agregar preparación · {etiquetaArea}
      </Boton>
    );

  return (
    <Pantalla
      titulo="Producción"
      subtitulo={
        isLoading
          ? "Cargando…"
          : itemsDelArea.length === 0
            ? `Sin preparaciones en ${etiquetaArea}`
            : urgentes.length > 0
              ? `${urgentes.length} para hacer · ${etiquetaArea}`
              : `Todo al día · ${etiquetaArea}`
      }
      ayuda={
        <>
          <p>
            Preparaciones de cocina: marcá{" "}
            <strong className="text-label">Hacer pronto</strong> cuando tengas
            que hacerlas, <strong className="text-label">Hecho</strong> cuando
            termines, y la app te avisa cuándo toca rehacer según cuánto duren.
          </p>
          <p>
            Al tocar Hecho se guarda la cantidad del recuadro. Si te
            equivocaste, tocá <strong className="text-label">Deshacer</strong>{" "}
            en el aviso de abajo.
          </p>
          <p>
            En la compu: <strong className="text-label">U</strong> muestra solo
            las urgentes y <strong className="text-label">Z</strong> deshace el
            último Hecho.
          </p>
        </>
      }
    >
      <Segmentado
        etiqueta="Área de producción"
        valor={areaActiva}
        onChange={cambiarArea}
        opciones={AREAS_PRODUCCION.map((area) => {
          const n = contadoresUrgentesPorArea[area];
          return {
            valor: area,
            label: (
              <>
                {ETIQUETA_AREA_PRODUCCION[area]}
                {n > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.8rem] font-semibold leading-5 tabular-nums text-on-accent">
                    {n}
                  </span>
                ) : null}
              </>
            ),
          };
        })}
      />

      {!isLoading && itemsDelArea.length > 0 ? (
        <div
          className={cx(
            "mt-3 flex min-h-12 items-center gap-3 rounded-card bg-surface-3 pl-4 pr-3",
            SOMBRA,
          )}
        >
          <span className="flex-1 text-[1rem] text-label">
            Solo urgentes
            <kbd className="ml-2 hidden rounded-md bg-fill px-1.5 py-0.5 font-mono text-[0.8rem] text-label-3 sm:inline">
              U
            </kbd>
          </span>
          <Interruptor
            etiqueta="Solo urgentes"
            activo={soloUrgentes}
            onChange={setSoloUrgentes}
          />
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6">
          <EsqueletoLista filas={6} />
        </div>
      ) : itemsDelArea.length === 0 ? (
        <>
          <EstadoVacio
            icono={<ChefHat className="h-6 w-6" aria-hidden />}
            titulo={`Sin preparaciones en ${etiquetaArea}`}
            texto="Agregá la primera para empezar a seguirla."
          />
          {renderBloqueAlta()}
        </>
      ) : (
        <>
          {urgentes.length === 0 ? (
            <div className="mt-4 flex gap-3 rounded-card bg-success-soft px-4 py-3 text-[0.94rem] text-success">
              <CircleCheck
                className="mt-0.5 h-[18px] w-[18px] shrink-0"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  Nada urgente en {etiquetaArea.toLowerCase()}.
                </p>
                {soloUrgentes && (alDia.length > 0 || inactivos.length > 0) ? (
                  <p className="mt-0.5 opacity-90">
                    Desactivá Solo urgentes para ver{" "}
                    {alDia.length + inactivos.length} preparación
                    {alDia.length + inactivos.length === 1 ? "" : "es"} al día.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {urgentes.length > 0 ? (
            <Seccion titulo={`Para hacer · ${urgentes.length}`}>
              <ul
                className={cx(
                  "overflow-hidden rounded-card bg-surface-3",
                  SOMBRA,
                )}
              >
                {urgentes.map(renderFilaCompacta)}
              </ul>
            </Seccion>
          ) : null}

          {!soloUrgentes && alDia.length > 0 ? (
            <Seccion
              titulo={`Al día · ${alDia.length}`}
              accion={
                <Boton
                  variante="terciario"
                  aria-expanded={alDiaExpandido}
                  onClick={() => setAlDiaExpandido((v) => !v)}
                  icono={
                    alDiaExpandido ? (
                      <ChevronDown className="h-[18px] w-[18px]" aria-hidden />
                    ) : (
                      <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
                    )
                  }
                >
                  {alDiaExpandido ? "Ocultar" : "Mostrar"}
                </Boton>
              }
            >
              {alDiaExpandido ? (
                <ul className="space-y-3">{alDia.map(renderFila)}</ul>
              ) : null}
            </Seccion>
          ) : null}

          {!soloUrgentes && urgentes.length === 0 && alDia.length === 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiCard
                icono={<ChefHat className="h-4 w-4" aria-hidden />}
                titulo="Hacer ahora"
                valor={kpis["Hacer ahora"]}
                tono="text-accent"
              />
              <KpiCard
                icono={<TriangleAlert className="h-4 w-4" aria-hidden />}
                titulo="Atrasadas"
                valor={kpis.Atrasado}
                tono="text-danger"
              />
              <KpiCard
                icono={<CalendarClock className="h-4 w-4" aria-hidden />}
                titulo="Rehacer pronto"
                valor={kpis["Rehacer pronto"]}
                tono="text-warning"
              />
              <KpiCard
                icono={<CircleCheck className="h-4 w-4" aria-hidden />}
                titulo="OK"
                valor={kpis.OK}
                tono="text-success"
              />
              <KpiCard
                icono={<CircleHelp className="h-4 w-4" aria-hidden />}
                titulo="Sin datos"
                valor={kpis["Sin datos"]}
                tono="text-label-3"
              />
            </div>
          ) : null}

          {!soloUrgentes && inactivos.length > 0 ? (
            <Seccion titulo={`Sin seguimiento · ${inactivos.length}`}>
              <ul className="space-y-3">{inactivos.map(renderFila)}</ul>
            </Seccion>
          ) : null}

          {!soloUrgentes ? renderBloqueAlta() : null}
        </>
      )}
    </Pantalla>
  );
}
