"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  actualizarVinculoPreparacion,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  guardarRecetaPreparacion,
  type AreaProduccion,
  type Preparacion,
} from "@/src/lib/preparaciones";
import {
  fetchPlatosCartaParaRecetas,
  fetchRecetaPorPlatoId,
  guardarRecetaPlato,
  recetaDesdeCampos,
  recetaTieneIngredientes,
  type PlatoCartaReceta,
} from "@/src/lib/recetas";

type IngredienteReceta = {
  nombre: string;
  gramos: string;
};

type Seleccion =
  | { origen: "prep"; id: string }
  | { origen: "plato"; id: string };

function encodeSeleccion(seleccion: Seleccion | null): string {
  if (!seleccion) {
    return "";
  }
  return seleccion.origen === "prep" ? `prep:${seleccion.id}` : `plato:${seleccion.id}`;
}

function parseSeleccion(valor: string): Seleccion | null {
  if (valor.startsWith("prep:")) {
    const id = valor.slice(5);
    return id ? { origen: "prep", id } : null;
  }
  if (valor.startsWith("plato:")) {
    const id = valor.slice(6);
    return id ? { origen: "plato", id } : null;
  }
  return null;
}

const filaVacia = (): IngredienteReceta => ({ nombre: "", gramos: "" });

function sumarGramosTotales(lista: IngredienteReceta[]): number {
  return lista.reduce((acc, fila) => {
    const nombre = fila.nombre.trim();
    const g = Number(String(fila.gramos).replace(",", ".").trim());
    if (!nombre || !(g > 0) || Number.isNaN(g)) {
      return acc;
    }
    return acc + g;
  }, 0);
}

export default function RecetaPage() {
  const [preps, setPreps] = useState<Preparacion[]>([]);
  const [platos, setPlatos] = useState<PlatoCartaReceta[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [ingredientes, setIngredientes] = useState<IngredienteReceta[]>([filaVacia()]);
  const [preparacion, setPreparacion] = useState("");
  const [preparacionGuardada, setPreparacionGuardada] = useState("");
  const [editandoPreparacion, setEditandoPreparacion] = useState(true);
  const [pax, setPax] = useState("");
  /** Última referencia usada para relación PAX ↔ gramos totales (se actualiza al recalcular o al cargar). */
  const [referenciaPax, setReferenciaPax] = useState<number | null>(null);
  const [referenciaGramosTotales, setReferenciaGramosTotales] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [soloAdmin, setSoloAdmin] = useState(false);
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);

  const seleccionKey = encodeSeleccion(seleccion);
  const hayCatalogo = preps.length > 0 || platos.length > 0;

  const prepSeleccionada = useMemo(
    () =>
      seleccion?.origen === "prep" ? (preps.find((p) => p.id === seleccion.id) ?? null) : null,
    [preps, seleccion]
  );
  const platoSeleccionado = useMemo(
    () =>
      seleccion?.origen === "plato"
        ? (platos.find((p) => p.id === seleccion.id) ?? null)
        : null,
    [platos, seleccion]
  );

  const prepsPorArea = useMemo(() => {
    const grupos: { area: AreaProduccion; items: Preparacion[] }[] = [
      { area: "barra", items: [] },
      { area: "delivery", items: [] },
    ];
    for (const prep of preps) {
      const grupo = grupos.find((g) => g.area === prep.area) ?? grupos[1];
      grupo.items.push(prep);
    }
    return grupos.filter((g) => g.items.length > 0);
  }, [preps]);

  const paxNumero = useMemo(() => {
    const n = Number(String(pax).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }, [pax]);

  const formatearGramos = (valor: number) => {
    const redondeado = Math.round(valor * 10) / 10;
    return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1);
  };

  const formatearPax = (valor: number) => {
    const redondeado = Math.round(valor * 10) / 10;
    return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1);
  };

  const recalcularRendimiento = () => {
    setError(null);
    setSuccess(null);
    const G = sumarGramosTotales(ingredientes);
    if (G <= 0) {
      setError("Necesitás al menos un ingrediente con nombre y gramos para recalcular el PAX.");
      return;
    }

    if (
      referenciaPax != null &&
      referenciaPax > 0 &&
      referenciaGramosTotales != null &&
      referenciaGramosTotales > 0
    ) {
      const nuevoPax = referenciaPax * (G / referenciaGramosTotales);
      const limpio = Math.max(0.1, Math.round(nuevoPax * 10) / 10);
      setPax(formatearPax(limpio));
      setReferenciaPax(limpio);
      setReferenciaGramosTotales(G);
      setSuccess("PAX recalculado según el peso total de ingredientes.");
      return;
    }

    if (paxNumero == null) {
      setError(
        "Indicá primero cuánto rinden esas cantidades (PAX inicial) y completá los gramos."
      );
      return;
    }

    setReferenciaPax(paxNumero);
    setReferenciaGramosTotales(G);
    setSuccess(
      "Referencia lista: PAX y gramos totales guardados. Volvé a usar este botón cuando cambie el peso total."
    );
  };

  const recalcularIngredientes = () => {
    setError(null);
    setSuccess(null);
    const G = sumarGramosTotales(ingredientes);

    if (paxNumero == null) {
      setError("Indicá el PAX (cuántos querés servir) para escalar las cantidades.");
      return;
    }

    if (
      referenciaPax == null ||
      referenciaPax <= 0 ||
      referenciaGramosTotales == null ||
      referenciaGramosTotales <= 0
    ) {
      if (G > 0) {
        setReferenciaPax(paxNumero);
        setReferenciaGramosTotales(G);
        setSuccess(
          "Referencia fijada con el PAX y los gramos actuales. Ajustá el PAX y tocá de nuevo para escalar."
        );
      } else {
        setError("Completá ingredientes con gramos o usá antes «Recalcular rendimiento».");
      }
      return;
    }

    const factor = paxNumero / referenciaPax;
    setIngredientes((actual) =>
      actual.map((fila) => {
        if (!fila.gramos.trim()) {
          return fila;
        }
        const g = Number(fila.gramos.replace(",", ".").trim());
        if (!(g > 0) || Number.isNaN(g)) {
          return fila;
        }
        return { ...fila, gramos: formatearGramos(g * factor) };
      })
    );

    const gramosNuevosTotales = referenciaGramosTotales * factor;
    setReferenciaPax(paxNumero);
    setReferenciaGramosTotales(Math.round(gramosNuevosTotales * 10) / 10);
    setSuccess("Gramos recalculados según el PAX indicado.");
  };

  const aplicarContenido = (contenido: {
    ingredientes: { nombre?: string; gramos?: string | number }[];
    pasos: string;
    pax: number | null;
  }) => {
    const normalizados = contenido.ingredientes.map((item) => ({
      nombre: item.nombre ?? "",
      gramos:
        typeof item.gramos === "number" ? String(item.gramos) : (item.gramos as string) ?? "",
    }));
    setIngredientes(normalizados.length > 0 ? normalizados : [filaVacia()]);
    setPreparacion(contenido.pasos);
    setPreparacionGuardada(contenido.pasos);
    setEditandoPreparacion(contenido.pasos.trim().length === 0);
    setPax(contenido.pax != null ? String(contenido.pax) : "");
    const totalG = sumarGramosTotales(normalizados);
    if (contenido.pax != null && totalG > 0) {
      setReferenciaPax(contenido.pax);
      setReferenciaGramosTotales(totalG);
    } else {
      setReferenciaPax(contenido.pax);
      setReferenciaGramosTotales(totalG > 0 ? totalG : null);
    }
  };

  const cargarLista = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listaPreps, listaPlatos] = await Promise.all([
        fetchPreparaciones(),
        fetchPlatosCartaParaRecetas(),
      ]);
      setPreps(listaPreps);
      setPlatos(listaPlatos);
      const params = new URLSearchParams(window.location.search);
      const prepUrl = params.get("prep");
      const platoUrl = params.get("plato");
      if (prepUrl && listaPreps.some((p) => p.id === prepUrl)) {
        setSeleccion({ origen: "prep", id: prepUrl });
      } else if (platoUrl && listaPlatos.some((p) => p.id === platoUrl)) {
        setSeleccion({ origen: "plato", id: platoUrl });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  const cargarReceta = async (actual: Seleccion | null) => {
    if (!actual) {
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      setSoloAdmin(false);
      return;
    }

    setError(null);

    if (actual.origen === "plato") {
      setSoloAdmin(false);
      try {
        const receta = await fetchRecetaPorPlatoId(actual.id);
        if (receta) {
          aplicarContenido(receta);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar la receta.");
        return;
      }
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      return;
    }

    const prep = preps.find((p) => p.id === actual.id);
    if (!prep) {
      return;
    }

    setSoloAdmin(prep.recetaSoloAdmin);
    const propia = recetaDesdeCampos({
      ingredientes: prep.recetaIngredientes,
      pasos: prep.proceso,
      pax: prep.recetaPax,
    });
    if (recetaTieneIngredientes(propia) || propia.pasos) {
      aplicarContenido(propia);
      return;
    }

    if (!prep.recetaPlatoId) {
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      return;
    }

    try {
      const heredada = await fetchRecetaPorPlatoId(prep.recetaPlatoId);
      if (heredada) {
        aplicarContenido(heredada);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la receta.");
      return;
    }
    aplicarContenido({ ingredientes: [], pasos: "", pax: null });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarLista();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarReceta(seleccion);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [seleccionKey]);

  const actualizarIngrediente = (index: number, patch: Partial<IngredienteReceta>) => {
    setIngredientes((actual) =>
      actual.map((fila, i) => (i === index ? { ...fila, ...patch } : fila))
    );
  };

  const agregarFilaIngrediente = () => {
    setIngredientes((actual) => [...actual, filaVacia()]);
  };

  const quitarFilaIngrediente = (index: number) => {
    setIngredientes((actual) =>
      actual.length <= 1 ? [filaVacia()] : actual.filter((_, i) => i !== index)
    );
  };

  const guardarReceta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!seleccion) {
      setError("Seleccioná un ítem de Tiempos Prep o un plato.");
      return;
    }

    if (seleccion.origen === "plato" && paxNumero === null) {
      setError("Indicá el rendimiento en PAX (número mayor que 0).");
      return;
    }

    const ingredientesPayload = ingredientes
      .map((fila) => ({
        nombre: fila.nombre.trim(),
        gramosRaw: fila.gramos.trim(),
      }))
      .filter((fila) => fila.nombre.length > 0);

    for (const fila of ingredientesPayload) {
      if (fila.gramosRaw === "") {
        setError(`Indica los gramos para: ${fila.nombre}`);
        return;
      }
      const gramos = Number(fila.gramosRaw.replace(",", "."));
      if (Number.isNaN(gramos) || gramos < 0) {
        setError("Revisa los gramos: deben ser números válidos.");
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const ingredientesGuardar = ingredientesPayload.map((fila) => ({
      nombre: fila.nombre,
      gramos: Number(fila.gramosRaw.replace(",", ".")),
    }));
    const paxGuardar = paxNumero != null ? Math.round(paxNumero) : null;

    try {
      if (seleccion.origen === "prep") {
        const actualizada = await guardarRecetaPreparacion(seleccion.id, {
          pax: paxGuardar,
          ingredientes: ingredientesGuardar,
          proceso: preparacion.trim(),
        });
        setPreps((actual) => actual.map((p) => (p.id === actualizada.id ? actualizada : p)));
        setSuccess(`Receta guardada para ${actualizada.nombre}.`);
      } else {
        await guardarRecetaPlato({
          platoId: seleccion.id,
          ingredientes: ingredientesGuardar,
          pasos: preparacion.trim(),
          pax: paxGuardar,
        });
        setSuccess(
          `Receta guardada para ${platoSeleccionado?.nombre ?? "el plato"}.`
        );
      }
      setPreparacionGuardada(preparacion.trim());
      setEditandoPreparacion(preparacion.trim().length === 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la receta.");
    } finally {
      setIsSaving(false);
    }
  };

  const guardarSoloAdmin = async (valor: boolean) => {
    if (seleccion?.origen !== "prep") {
      return;
    }
    setSoloAdmin(valor);
    setGuardandoAcceso(true);
    try {
      const actualizada = await actualizarVinculoPreparacion(seleccion.id, {
        recetaSoloAdmin: valor,
      });
      setPreps((actual) => actual.map((p) => (p.id === actualizada.id ? actualizada : p)));
    } catch (err) {
      setSoloAdmin(!valor);
      setError(err instanceof Error ? err.message : "No se pudo guardar el acceso.");
    } finally {
      setGuardandoAcceso(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
            Recetas y procesos
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Hay dos orígenes: lo que agregás en{" "}
            <Link href="/produccion-tiempos" className="underline hover:text-zinc-200">
              Tiempos Prep
            </Link>{" "}
            (procesos que hacés) y los platos que se sirven, que se crean en{" "}
            <Link href="/platos" className="underline hover:text-zinc-200">
              Platos
            </Link>
            . Acá cargás la receta o el proceso de ese ítem.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mb-4 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando recetas...
          </div>
        ) : !hayCatalogo ? (
          <p className="text-sm text-zinc-400">
            Todavía no hay ítems. Agregá una preparación en{" "}
            <Link href="/produccion-tiempos" className="underline hover:text-zinc-200">
              Tiempos Prep
            </Link>{" "}
            o un plato en{" "}
            <Link href="/platos" className="underline hover:text-zinc-200">
              Platos
            </Link>
            , y después volvé acá a cargar la receta.
          </p>
        ) : (
          <form onSubmit={guardarReceta} className="space-y-6">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.14em] text-zinc-500">
                Ítem
              </label>
              <select
                value={seleccionKey}
                onChange={(e) => {
                  setSeleccion(parseSeleccion(e.target.value));
                  setSuccess(null);
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
              >
                <option value="">Seleccionar…</option>
                {prepsPorArea.map((grupo) => (
                  <optgroup
                    key={grupo.area}
                    label={`Tiempos Prep · ${ETIQUETA_AREA_PRODUCCION[grupo.area]}`}
                  >
                    {grupo.items.map((prep) => (
                      <option key={prep.id} value={encodeSeleccion({ origen: "prep", id: prep.id })}>
                        {prep.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {platos.length > 0 ? (
                  <optgroup label="Platos">
                    {platos.map((plato) => (
                      <option
                        key={plato.id}
                        value={encodeSeleccion({ origen: "plato", id: plato.id })}
                      >
                        {plato.nombre}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <p className="mt-2 text-[11px] text-zinc-500">
                Lo nuevo de cocina se agrega en{" "}
                <Link href="/produccion-tiempos" className="underline hover:text-zinc-300">
                  Tiempos Prep
                </Link>
                . Los platos que se sirven, en{" "}
                <Link href="/platos" className="underline hover:text-zinc-300">
                  Platos
                </Link>
                .
              </p>
              {prepSeleccionada ? (
                <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={soloAdmin}
                    onChange={(e) => void guardarSoloAdmin(e.target.checked)}
                    disabled={guardandoAcceso}
                    className="rounded border-zinc-600"
                  />
                  Solo Manu puede ver esta receta en el plan
                </label>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <label className="mb-2 block text-xs uppercase tracking-[0.14em] text-zinc-500">
                Rendimiento — PAX inicial
              </label>
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                {seleccion?.origen === "plato"
                  ? "Cuántas porciones rinden las cantidades en gramos (obligatorio en platos)."
                  : "Cuánto rinde esta receta (opcional en Tiempos Prep). Después podés recalcular PAX o gramos."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pax}
                  onChange={(e) => setPax(e.target.value)}
                  placeholder="Ej. 10"
                  disabled={!seleccionKey}
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50"
                  aria-label="PAX inicial, cuánto rinden esas cantidades"
                />
                <button
                  type="button"
                  onClick={recalcularRendimiento}
                  disabled={!seleccionKey}
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Recalcular rendimiento
                </button>
              </div>
              {referenciaPax != null && referenciaGramosTotales != null ? (
                <p className="mt-2 text-[11px] text-zinc-600">
                  Referencia actual: {referenciaPax} PAX · {referenciaGramosTotales} g total
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-600">
                  Sin referencia: completá PAX y gramos, luego «Recalcular rendimiento» para
                  fijarla.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm uppercase tracking-[0.16em] text-zinc-400">Ingredientes</h2>
                <button
                  type="button"
                  onClick={recalcularIngredientes}
                  disabled={!seleccionKey}
                  className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Recalcular ingredientes
                </button>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                Ajustá el PAX arriba (ej. más o menos comensales) y tocá «Recalcular
                ingredientes» para escalar todos los gramos en la misma proporción. Si
                cambiás solo los gramos, usá «Recalcular rendimiento» para actualizar el PAX.
              </p>
              <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                <span className="min-w-0 flex-1 pl-2">Ingrediente</span>
                <span className="w-14 shrink-0 text-center sm:w-16">g</span>
                <span className="w-12 shrink-0 text-center text-zinc-600">g/PAX</span>
                <span className="inline-block w-8 shrink-0" aria-hidden />
              </div>
              <div className="space-y-1.5">
                {ingredientes.map((fila, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-2 py-1.5"
                  >
                    <input
                      value={fila.nombre}
                      onChange={(e) => actualizarIngrediente(index, { nombre: e.target.value })}
                      placeholder="Ingrediente"
                      disabled={!seleccionKey}
                      aria-label={`Ingrediente ${index + 1}`}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-50"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fila.gramos}
                      onChange={(e) => actualizarIngrediente(index, { gramos: e.target.value })}
                      placeholder="0"
                      disabled={!seleccionKey}
                      aria-label={`Gramos ${index + 1}`}
                      className="w-14 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-center text-sm tabular-nums text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50 sm:w-16"
                    />
                    <span
                      className="w-12 shrink-0 text-center text-[11px] tabular-nums text-zinc-500"
                      title="Gramos por porción (PAX)"
                    >
                      {paxNumero && fila.gramos.trim()
                        ? (() => {
                            const g = Number(fila.gramos.replace(",", ".").trim());
                            if (!(g > 0) || Number.isNaN(g)) {
                              return "—";
                            }
                            return (g / paxNumero).toFixed(1);
                          })()
                        : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarFilaIngrediente(index)}
                      disabled={!seleccionKey}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-1.5 text-zinc-500 transition hover:border-zinc-700 hover:text-red-300 disabled:opacity-50"
                      aria-label="Quitar fila"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={agregarFilaIngrediente}
                disabled={!seleccionKey}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Añadir ingrediente
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm uppercase tracking-[0.16em] text-zinc-400">
                  Preparación
                </h2>
                {seleccionKey && preparacionGuardada.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditandoPreparacion((prev) => !prev)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                  >
                    {editandoPreparacion ? "Ver compacto" : "Editar"}
                  </button>
                ) : null}
              </div>

              {editandoPreparacion ? (
                <>
                  <textarea
                    value={preparacion}
                    onChange={(e) => setPreparacion(e.target.value)}
                    disabled={!seleccionKey}
                    rows={10}
                    placeholder="Pasos, tiempos, temperaturas..."
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50"
                  />
                  {seleccionKey && preparacionGuardada.trim().length > 0 ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPreparacion(preparacionGuardada);
                          setEditandoPreparacion(false);
                        }}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        Cancelar edición
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                  {preparacionGuardada}
                </article>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || !seleccionKey}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar receta
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
