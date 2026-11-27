"use client";

import {
  ChevronDown,
  CircleAlert,
  FilePlus,
  Plus,
  Trash2,
  Wine,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Boton,
  BotonIcono,
  EstadoVacio,
  Esqueleto,
  EsqueletoLista,
  Etiqueta,
  Pantalla,
  Seccion,
  cx,
  useAvisos,
  vibrar,
} from "@/app/ui";

import {
  esFormatoBebida,
  FORMATOS_BEBIDA,
  type FormatoBebida,
} from "@/src/lib/bebidas-asientos";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  etiquetaServicioHistorial,
  fetchUltimoHistorialServicio,
  type HistorialServicioRow,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";

type BebidaItem = {
  id: string;
  bebida: string;
  cantidad: string;
  formato: FormatoBebida | "";
};

/** Números de asiento en orden de visualización. Los dos primeros (-2, -1) son
 * los asientos extra habilitados; luego siguen 1..8. Se usan como valor real de
 * la columna `asiento` en la base. */
const ASIENTOS_NUMEROS = [-2, -1, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const TOTAL_ASIENTOS = ASIENTOS_NUMEROS.length;
const STORAGE_KEY = "omakase_bebidas_v3";

type BebidaAsientoRow = {
  historial_servicio_id: string;
  asiento: number;
  consumos: BebidaItem[] | null;
};

const crearItem = (): BebidaItem => ({
  id: crypto.randomUUID(),
  bebida: "",
  cantidad: "",
  formato: "",
});

const crearEstadoVacio = (): BebidaItem[][] =>
  Array.from({ length: TOTAL_ASIENTOS }, () => [crearItem()]);

const normalizarConsumos = (
  consumos: BebidaItem[] | null | undefined,
): BebidaItem[] => {
  const lista = Array.isArray(consumos) ? consumos : [];
  const normalizados = lista
    .map((item): BebidaItem => ({
      id: item.id || crypto.randomUUID(),
      bebida: typeof item.bebida === "string" ? item.bebida : "",
      cantidad: typeof item.cantidad === "string" ? item.cantidad : "",
      formato: esFormatoBebida(item.formato) ? item.formato : "",
    }))
    .filter(
      (item) => item.bebida.trim() || item.cantidad.trim() || item.formato,
    );
  return normalizados.length > 0 ? normalizados : [crearItem()];
};

/** Cuenta como bebida si tiene nombre o si es un extra (el atajo no pide nombre). */
const lineaCargada = (item: BebidaItem): boolean =>
  item.bebida.trim().length > 0 || item.formato === "Extra";

const hayConsumosCargados = (asientos: BebidaItem[][]): boolean =>
  asientos.some((items) => items.some(lineaCargada));

/** Copia que guarda el celu mientras se anota (por si la nube falla). */
const leerCopiaLocal = (historialServicioId: string): BebidaItem[][] | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const copia = JSON.parse(raw) as {
      historialServicioId?: string;
      asientos?: unknown;
    };
    if (
      copia.historialServicioId !== historialServicioId ||
      !Array.isArray(copia.asientos) ||
      copia.asientos.length !== TOTAL_ASIENTOS
    ) {
      return null;
    }
    const asientos = copia.asientos.map((items) =>
      normalizarConsumos(Array.isArray(items) ? (items as BebidaItem[]) : null),
    );
    return hayConsumosCargados(asientos) ? asientos : null;
  } catch {
    return null;
  }
};

const CANTIDADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

/** Cantidad a número: vacío o no parseable cuenta como 1. */
const cantidadANumero = (cantidad: string): number => {
  const n = Number(cantidad.replace(",", "."));
  return cantidad.trim() && Number.isFinite(n) && n > 0 ? n : 1;
};

const extrasDelAsiento = (items: BebidaItem[]): number =>
  items
    .filter((item) => item.formato === "Extra")
    .reduce((acc, item) => acc + cantidadANumero(item.cantidad), 0);

export default function BebidasPage() {
  const [bebidasPorAsiento, setBebidasPorAsiento] =
    useState<BebidaItem[][]>(crearEstadoVacio);
  const [servicioActivo, setServicioActivo] =
    useState<HistorialServicioRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  /** Línea con el selector de cantidad (1–10) desplegado. */
  const [cantidadAbierta, setCantidadAbierta] = useState<string | null>(null);
  /** Índice en ASIENTOS_NUMEROS del asiento que se está anotando (arranca en el 1). */
  const [asientoElegido, setAsientoElegido] = useState(2);
  const { aviso, confirmar } = useAvisos();
  const cargadoRemotoRef = useRef(false);
  /**
   * Solo se guarda (en la nube y en el celu) cuando alguien cambió algo. Abrir
   * la página nunca escribe: así un fallo al cargar no pisa lo que ya había.
   */
  const hayCambiosRef = useRef(false);
  const recuperacionOfrecidaRef = useRef(false);
  const timerSyncRef = useRef<number | null>(null);
  const servicioActivoIdRef = useRef<string | null>(null);

  // Va antes del efecto de sincronización: en el mismo commit se actualiza primero.
  useEffect(() => {
    servicioActivoIdRef.current = servicioActivo?.id ?? null;
  }, [servicioActivo?.id]);

  /** Si la nube vino vacía pero este celu tiene bebidas anotadas, ofrece subirlas. */
  const ofrecerRecuperar = useEffectEvent(async (local: BebidaItem[][]) => {
    if (recuperacionOfrecidaRef.current) {
      return;
    }
    recuperacionOfrecidaRef.current = true;
    const n = local.reduce(
      (acc, items) => acc + items.filter(lineaCargada).length,
      0,
    );
    const ok = await confirmar({
      titulo: "Recuperar bebidas de este celu",
      texto: `Este celu tiene ${n} ${n === 1 ? "bebida anotada" : "bebidas anotadas"} de este servicio que ${n === 1 ? "no está" : "no están"} en la nube. ¿${n === 1 ? "La" : "Las"} recuperás?`,
      confirmar: "Recuperar",
    });
    if (!ok) {
      return;
    }
    hayCambiosRef.current = true;
    setBebidasPorAsiento(local);
    aviso("Bebidas recuperadas", { tono: "exito" });
  });

  const cargarBebidasParaServicio = useCallback(async (historialId: string) => {
    const { data, error } = await supabase
      .from("bebidas_asientos")
      .select("historial_servicio_id, asiento, consumos")
      .eq("historial_servicio_id", historialId)
      .order("asiento", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as BebidaAsientoRow[];
    return Array.from({ length: TOTAL_ASIENTOS }, (_, i) => {
      const row = rows.find((r) => r.asiento === ASIENTOS_NUMEROS[i]);
      return normalizarConsumos(row?.consumos);
    });
  }, []);

  const activarServicio = useCallback(
    async (
      row: HistorialServicioRow,
      opts?: { limpiarSiSinDatosEnNube?: boolean },
    ) => {
      setSyncError(null);
      let asientos = crearEstadoVacio();
      try {
        asientos = await cargarBebidasParaServicio(row.id);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las bebidas del servicio.";
        if (msg.includes("historial_servicio_id") || msg.includes("column")) {
          setSyncError(
            `${msg} — Ejecutá en Supabase el script supabase/bebidas-asientos-historial-servicio.sql`,
          );
        } else {
          setSyncError(formatPostgrestError(err as { message: string }));
        }
        // Sin datos de la nube no se puede guardar encima: quedaría vacío.
        setServicioActivo(row);
        setBebidasPorAsiento(crearEstadoVacio());
        cargadoRemotoRef.current = false;
        return null;
      }

      if (opts?.limpiarSiSinDatosEnNube && !hayConsumosCargados(asientos)) {
        asientos = crearEstadoVacio();
      }

      hayCambiosRef.current = false;
      setServicioActivo(row);
      setBebidasPorAsiento(asientos);
      cargadoRemotoRef.current = true;
      return asientos;
    },
    [cargarBebidasParaServicio],
  );

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setSyncError(null);
      try {
        const ultimo = await fetchUltimoHistorialServicio();
        if (!ultimo) {
          setServicioActivo(null);
          setBebidasPorAsiento(crearEstadoVacio());
          cargadoRemotoRef.current = true;
          return;
        }
        const remoto = await activarServicio(ultimo);
        if (remoto && !hayConsumosCargados(remoto)) {
          const local = leerCopiaLocal(ultimo.id);
          if (local) {
            ofrecerRecuperar(local);
          }
        }
      } catch (err) {
        setSyncError(
          err instanceof Error
            ? formatPostgrestError(err as { message: string })
            : "Error al cargar el último servicio.",
        );
        cargadoRemotoRef.current = false;
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [activarServicio]);

  useEffect(() => {
    // Nombres de la Guía de bebidas para autocompletar (si falla, se escribe a mano).
    let cancelado = false;
    void supabase
      .from("guia_bebidas")
      .select("nombre")
      .eq("activa", true)
      .order("orden", { ascending: true })
      .then(({ data }) => {
        if (!cancelado && data) {
          setSugerencias(data.map((d: { nombre: string }) => d.nombre));
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!servicioActivo?.id || !hayCambiosRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          historialServicioId: servicioActivo.id,
          asientos: bebidasPorAsiento,
        }),
      );
    } catch {
      // Ignora fallos de almacenamiento local.
    }
  }, [bebidasPorAsiento, servicioActivo?.id]);

  useEffect(() => {
    if (
      !cargadoRemotoRef.current ||
      !servicioActivoIdRef.current ||
      !hayCambiosRef.current
    ) {
      return;
    }

    if (timerSyncRef.current) {
      window.clearTimeout(timerSyncRef.current);
    }

    const historialId = servicioActivoIdRef.current;

    timerSyncRef.current = window.setTimeout(() => {
      const sync = async () => {
        setIsSyncing(true);
        const payload = bebidasPorAsiento.map((consumos, index) => ({
          historial_servicio_id: historialId,
          asiento: ASIENTOS_NUMEROS[index],
          consumos,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("bebidas_asientos")
          .upsert(payload, { onConflict: "historial_servicio_id,asiento" });

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
  }, [bebidasPorAsiento]);

  const totalItemsCargados = useMemo(() => {
    return bebidasPorAsiento.reduce(
      (acc, asiento) => acc + asiento.filter(lineaCargada).length,
      0,
    );
  }, [bebidasPorAsiento]);

  const actualizarItem = (
    asientoIndex: number,
    itemId: string,
    patch: Partial<BebidaItem>,
  ) => {
    hayCambiosRef.current = true;
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) =>
        i !== asientoIndex
          ? items
          : items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
      ),
    );
  };

  const agregarItem = (asientoIndex: number) => {
    hayCambiosRef.current = true;
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) =>
        i === asientoIndex ? [...items, crearItem()] : items,
      ),
    );
  };

  /**
   * Atajo: suma un extra al asiento. Si ya hay una línea de Extra le sube la
   * cantidad; si no, usa la línea vacía o agrega una nueva.
   */
  const agregarExtra = (asientoIndex: number) => {
    vibrar();
    hayCambiosRef.current = true;
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) => {
        if (i !== asientoIndex) {
          return items;
        }
        const ultimoExtra = [...items]
          .reverse()
          .find((item) => item.formato === "Extra");
        if (ultimoExtra) {
          const siguiente = String(cantidadANumero(ultimoExtra.cantidad) + 1);
          return items.map((item) =>
            item.id === ultimoExtra.id
              ? { ...item, cantidad: siguiente }
              : item,
          );
        }
        const vacia = items.find(
          (item) =>
            !item.bebida.trim() && !item.cantidad.trim() && !item.formato,
        );
        if (vacia) {
          return items.map((item) =>
            item.id === vacia.id
              ? { ...item, cantidad: "1", formato: "Extra" as const }
              : item,
          );
        }
        return [
          ...items,
          { ...crearItem(), cantidad: "1", formato: "Extra" as const },
        ];
      }),
    );
  };

  const quitarItem = (asientoIndex: number, itemId: string) => {
    hayCambiosRef.current = true;
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) => {
        if (i !== asientoIndex) {
          return items;
        }
        if (items.length <= 1) {
          return [crearItem()];
        }
        return items.filter((item) => item.id !== itemId);
      }),
    );
  };

  const limpiarAsientosActuales = () => {
    hayCambiosRef.current = true;
    setBebidasPorAsiento(crearEstadoVacio());
  };

  const iniciarNuevoServicio = async () => {
    setSyncError(null);
    setIsLoading(true);
    try {
      const ultimo = await fetchUltimoHistorialServicio();
      if (!ultimo) {
        setSyncError(
          "No hay ningún menú guardado en historial. Cerrá un menú en la página principal antes de tomar bebidas.",
        );
        return;
      }

      const mismoServicio = servicioActivo?.id === ultimo.id;
      if (mismoServicio && hayConsumosCargados(bebidasPorAsiento)) {
        const ok = await confirmar({
          titulo: "¿Empezar de cero las bebidas?",
          texto: `Se borran las líneas actuales de ${etiquetaServicioHistorial(ultimo)}.`,
          confirmar: "Empezar de cero",
          peligro: true,
        });
        if (!ok) {
          return;
        }
        await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
        hayCambiosRef.current = true;
        setBebidasPorAsiento(crearEstadoVacio());
        aviso(`Toma reiniciada: ${etiquetaServicioHistorial(ultimo)}`);
        return;
      }

      if (!mismoServicio) {
        await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
        aviso(`Bebidas ligadas a ${etiquetaServicioHistorial(ultimo)}`, {
          tono: "exito",
        });
        return;
      }

      await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
      aviso(`Servicio activo: ${etiquetaServicioHistorial(ultimo)}`);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? formatPostgrestError(err as { message: string })
          : "No se pudo actualizar el servicio activo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const sinServicio = !isLoading && !servicioActivo;

  const confirmarLimpiar = async () => {
    if (hayConsumosCargados(bebidasPorAsiento)) {
      const ok = await confirmar({
        titulo: "¿Vaciar todos los asientos?",
        texto: "Se borran las bebidas cargadas en este servicio.",
        confirmar: "Vaciar asientos",
        peligro: true,
      });
      if (!ok) {
        return;
      }
    }
    limpiarAsientosActuales();
    aviso("Asientos vaciados");
  };

  const elegirAsiento = (index: number) => {
    vibrar();
    setAsientoElegido(index);
    setCantidadAbierta(null);
  };

  const estadoSync = isSyncing
    ? { texto: "Guardando…", tono: "neutro" as const }
    : syncError
      ? { texto: "Sin guardar", tono: "peligro" as const }
      : lastSyncLabel
        ? { texto: `Guardado ${lastSyncLabel}`, tono: "exito" as const }
        : { texto: "Al día", tono: "neutro" as const };

  return (
    <Pantalla
      titulo="Bebidas"
      subtitulo={
        isLoading
          ? "Cargando…"
          : servicioActivo
            ? etiquetaServicioHistorial(servicioActivo)
            : "Sin servicio activo"
      }
      ayuda={
        <>
          <p>
            Las bebidas se guardan ligadas al{" "}
            <strong className="text-label">último menú cerrado</strong> en el
            historial, asiento por asiento, y se sincronizan solas mientras
            escribís.
          </p>
          <p>
            Cuando cerraste otro menú y arranca otro servicio, tocá{" "}
            <strong className="text-label">Nuevo servicio</strong> para empezar
            una toma en blanco ligada a ese menú.
          </p>
          <p>Al escribir, la app sugiere nombres de la Guía de bebidas.</p>
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

      {isLoading ? (
        <div className="space-y-4">
          <Esqueleto className="h-24 w-full rounded-card" />
          <EsqueletoLista filas={4} />
        </div>
      ) : sinServicio ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<Wine className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay menús cerrados"
            texto="Cerrá un servicio en Omakase con «Cerrar menú y guardar» y volvé para tomar bebidas."
            accion={
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-on-accent"
              >
                Ir a Omakase
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.94rem] text-label-2">
                <span className="font-semibold tabular-nums text-label">
                  {totalItemsCargados}
                </span>{" "}
                {totalItemsCargados === 1 ? "bebida" : "bebidas"}
              </p>
              <Etiqueta tono={estadoSync.tono}>{estadoSync.texto}</Etiqueta>
            </div>
            <MapaBarra
              conteos={bebidasPorAsiento.map(
                (items) => items.filter(lineaCargada).length,
              )}
              elegido={asientoElegido}
              onElegir={elegirAsiento}
            />
          </div>

          <datalist id="bebidas-sugeridas">
            {sugerencias.map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>

          <div>
            {bebidasPorAsiento.map((items, asientoIndex) =>
              asientoIndex !== asientoElegido ? null : (
                <div
                  key={asientoIndex}
                  className="animate-[vt-aparecer-plano_160ms_ease-out]"
                >
                  <Seccion
                    titulo={`Asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                    accion={
                      <div className="flex items-center gap-1">
                        <BotonExtra
                          cantidad={extrasDelAsiento(items)}
                          onClick={() => agregarExtra(asientoIndex)}
                          etiqueta={`Sumar un extra en asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                        />
                        <Boton
                          variante="terciario"
                          tamano="chico"
                          icono={<Plus className="h-4 w-4" aria-hidden />}
                          onClick={() => agregarItem(asientoIndex)}
                          aria-label={`Agregar bebida en asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                        >
                          Añadir
                        </Boton>
                      </div>
                    }
                  >
                    <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="border-b border-separator py-1.5 pl-4 pr-1.5 last:border-0"
                        >
                          <div className="flex min-h-11 items-center gap-2">
                            <input
                              value={item.bebida}
                              onChange={(e) =>
                                actualizarItem(asientoIndex, item.id, {
                                  bebida: e.target.value,
                                })
                              }
                              placeholder="Qué tomó…"
                              list="bebidas-sugeridas"
                              aria-label={`Bebida, asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                              className="min-w-0 flex-1 bg-transparent py-2 text-[1rem] text-label outline-none placeholder:text-label-3"
                            />
                            <BotonIcono
                              etiqueta="Quitar esta bebida"
                              variante="plano"
                              icono={
                                <Trash2
                                  className="h-[18px] w-[18px]"
                                  aria-hidden
                                />
                              }
                              onClick={() => quitarItem(asientoIndex, item.id)}
                              className="text-label-3 hover:text-danger"
                            />
                          </div>
                          <div className="flex items-center gap-2 pb-1.5 pr-2.5">
                            <button
                              type="button"
                              aria-expanded={cantidadAbierta === item.id}
                              aria-label={`Cantidad, asiento ${ASIENTOS_NUMEROS[asientoIndex]}: ${item.cantidad || "sin indicar"}`}
                              onClick={() => {
                                vibrar();
                                setCantidadAbierta((abierta) =>
                                  abierta === item.id ? null : item.id,
                                );
                              }}
                              className={cx(
                                "inline-flex h-10 w-14 shrink-0 items-center justify-center gap-0.5 rounded-[0.6rem] text-[1rem] tabular-nums transition-colors",
                                cantidadAbierta === item.id
                                  ? "bg-accent-soft text-accent ring-2 ring-accent/60"
                                  : "bg-fill",
                                item.cantidad
                                  ? "font-semibold text-label"
                                  : "text-label-3",
                              )}
                            >
                              {item.cantidad || "Cant."}
                              <ChevronDown
                                className={cx(
                                  "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                                  cantidadAbierta === item.id && "rotate-180",
                                )}
                                aria-hidden
                              />
                            </button>
                            <SelectorFormato
                              valor={item.formato}
                              etiqueta={`Formato, asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                              onChange={(formato) =>
                                actualizarItem(asientoIndex, item.id, {
                                  formato,
                                })
                              }
                            />
                          </div>
                          {cantidadAbierta === item.id ? (
                            <div
                              role="radiogroup"
                              aria-label={`Elegir cantidad, asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
                              className="grid grid-cols-5 gap-1.5 pb-2 pr-2.5"
                            >
                              {CANTIDADES.map((n) => {
                                const activo = item.cantidad === n;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={activo}
                                    onClick={() => {
                                      vibrar();
                                      actualizarItem(asientoIndex, item.id, {
                                        cantidad: activo ? "" : n,
                                      });
                                      setCantidadAbierta(null);
                                    }}
                                    className={cx(
                                      "h-11 rounded-[0.6rem] text-[1.05rem] tabular-nums transition active:scale-95",
                                      activo
                                        ? "bg-accent font-semibold text-on-accent"
                                        : "bg-fill text-label active:bg-fill-strong",
                                    )}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Seccion>
                </div>
              ),
            )}
          </div>

          <Seccion titulo="Servicio">
            <div className="grid grid-cols-2 gap-2">
              <Boton
                variante="secundario"
                icono={<FilePlus className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void iniciarNuevoServicio()}
                disabled={isLoading}
              >
                Nuevo servicio
              </Boton>
              <Boton
                variante="peligro"
                onClick={() => void confirmarLimpiar()}
                disabled={isLoading}
              >
                Vaciar asientos
              </Boton>
            </div>
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}

/** Copa / Tokkuri / Botella / Extra. Tocar el elegido lo deja sin indicar. */
function SelectorFormato({
  valor,
  onChange,
  etiqueta,
}: {
  valor: FormatoBebida | "";
  onChange: (valor: FormatoBebida | "") => void;
  etiqueta: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-[0.75rem] bg-fill p-[3px]"
    >
      {FORMATOS_BEBIDA.map((formato) => {
        const activo = formato === valor;
        return (
          <button
            key={formato}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => {
              vibrar();
              onChange(activo ? "" : formato);
            }}
            className={cx(
              "inline-flex h-[34px] min-w-0 items-center justify-center rounded-[0.6rem] px-1 text-[0.82rem] transition-colors",
              activo
                ? "bg-accent font-semibold text-on-accent shadow-[0_1px_3px_rgb(0_0_0/0.14)]"
                : "text-label active:bg-fill-strong",
            )}
          >
            {formato}
          </button>
        );
      })}
    </div>
  );
}

/** Atajo del asiento: cada toque suma un extra. Muestra cuántos lleva. */
function BotonExtra({
  cantidad,
  onClick,
  etiqueta,
}: {
  cantidad: number;
  onClick: () => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${etiqueta}${cantidad > 0 ? ` (lleva ${cantidad})` : ""}`}
      className={cx(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.9rem] font-semibold transition active:scale-95",
        cantidad > 0
          ? "bg-accent-soft text-accent"
          : "bg-fill text-label-2 active:bg-fill-strong",
      )}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      Extra
      {cantidad > 0 ? (
        <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[0.78rem] leading-5 tabular-nums text-on-accent">
          {cantidad}
        </span>
      ) : null}
    </button>
  );
}

/**
 * La barra vista desde arriba: una L con el tramo largo arriba (asientos 1 a 8,
 * hacia la derecha) y la pata corta bajando por la izquierda (-1 y, abajo, -2).
 * El interior de la barra queda abajo a la derecha. Tocar un asiento lo abre
 * para anotar.
 */
function MapaBarra({
  conteos,
  elegido,
  onElegir,
}: {
  conteos: number[];
  elegido: number;
  onElegir: (index: number) => void;
}) {
  // Posición en la grilla (columna, fila) de cada asiento, en el orden de ASIENTOS_NUMEROS.
  const posicion = (index: number) =>
    index < 2
      ? { gridColumn: 1, gridRow: 4 - index }
      : { gridColumn: index, gridRow: 1 };

  return (
    <div
      role="radiogroup"
      aria-label="Asiento a anotar"
      className="mt-4 grid gap-x-1 gap-y-1.5"
      style={{
        gridTemplateColumns: "repeat(9, minmax(0, 1fr))",
        gridTemplateRows: "auto 0.6rem auto auto",
      }}
    >
      {/* Barra: pata corta vertical + tramo largo horizontal. */}
      <div
        aria-hidden
        className="w-2.5 justify-self-start rounded-b-full bg-fill-strong"
        style={{ gridColumn: 2, gridRow: "2 / 5" }}
      />
      <div
        aria-hidden
        className="rounded-r-full bg-fill-strong"
        style={{ gridColumn: "2 / 10", gridRow: 2 }}
      />
      <div
        aria-hidden
        className="flex items-center justify-center text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-label-3"
        style={{ gridColumn: "3 / 10", gridRow: "3 / 5" }}
      >
        Barra
      </div>

      {ASIENTOS_NUMEROS.map((numero, index) => {
        const n = conteos[index] ?? 0;
        const activo = index === elegido;
        return (
          <button
            key={numero}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={`Asiento ${numero}: ${n} ${n === 1 ? "bebida" : "bebidas"}`}
            onClick={() => onElegir(index)}
            style={posicion(index)}
            className={cx(
              "relative flex min-h-12 min-w-0 flex-col items-center justify-center rounded-[0.7rem] transition active:scale-95",
              activo
                ? "bg-accent text-on-accent shadow-[0_2px_8px_rgb(0_0_0/0.18)]"
                : n > 0
                  ? "bg-accent-soft text-accent"
                  : "bg-fill text-label-2",
            )}
          >
            <span className="font-mono text-[0.95rem] font-semibold tabular-nums leading-none">
              {numero}
            </span>
            <span
              className={cx(
                "mt-1 text-[0.66rem] leading-none tabular-nums",
                n > 0 ? "opacity-90" : "opacity-50",
              )}
            >
              {n > 0 ? n : "·"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
