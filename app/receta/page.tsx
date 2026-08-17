"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";
import {
  borrarPlatoRecetaBase,
  crearPlatoRecetaBase,
  fetchPlatosCatalogoRecetas,
  type PlatoCatalogoReceta,
} from "@/src/lib/recetas";

type Plato = PlatoCatalogoReceta;

type IngredienteReceta = {
  nombre: string;
  gramos: string;
};

type RecetaRow = {
  plato_id: string;
  ingredientes: IngredienteReceta[] | null;
  preparacion: string | null;
  pax: number | null;
};

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
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [platoId, setPlatoId] = useState<string>("");
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
  const [creandoBase, setCreandoBase] = useState(false);
  const [nombreNuevaBase, setNombreNuevaBase] = useState("");
  const [isCreatingBase, setIsCreatingBase] = useState(false);
  const [isDeletingBase, setIsDeletingBase] = useState(false);

  const platoSeleccionado = useMemo(
    () => platos.find((p) => p.id === platoId),
    [platos, platoId]
  );

  const platosBase = useMemo(
    () => platos.filter((p) => p.tipo === "base"),
    [platos]
  );
  const platosCarta = useMemo(
    () => platos.filter((p) => p.tipo === "carta"),
    [platos]
  );

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

  const cargarPlatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPlatosCatalogoRecetas();
      setPlatos(data);
      const fromUrl = new URLSearchParams(window.location.search).get("plato");
      if (fromUrl && data.some((p) => p.id === fromUrl)) {
        setPlatoId(fromUrl);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cargarReceta = async (id: string) => {
    if (!id) {
      setIngredientes([filaVacia()]);
      setPreparacion("");
      setPreparacionGuardada("");
      setEditandoPreparacion(true);
      setPax("");
      setReferenciaPax(null);
      setReferenciaGramosTotales(null);
      return;
    }

    setError(null);
    let data: unknown = null;
    let recetaError: { message: string } | null = null;
    try {
      const result = await supabase
        .from("recetas")
        .select("plato_id, ingredientes, preparacion, pax")
        .eq("plato_id", id)
        .maybeSingle();
      data = result.data;
      recetaError = result.error;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar la receta desde Supabase."
      );
      return;
    }

    if (recetaError) {
      setError(formatPostgrestError(recetaError));
      return;
    }

    const row = data as RecetaRow | null;
    if (!row) {
      setIngredientes([filaVacia()]);
      setPreparacion("");
      setPreparacionGuardada("");
      setEditandoPreparacion(true);
      setPax("");
      setReferenciaPax(null);
      setReferenciaGramosTotales(null);
      return;
    }

    const lista = (row.ingredientes as IngredienteReceta[] | null) ?? [];
    const normalizados = lista.map((item) => ({
      nombre: item.nombre ?? "",
      gramos:
        typeof item.gramos === "number"
          ? String(item.gramos)
          : (item.gramos as string) ?? "",
    }));
    setIngredientes(normalizados.length > 0 ? normalizados : [filaVacia()]);
    const prep = row.preparacion ?? "";
    setPreparacion(prep);
    setPreparacionGuardada(prep);
    setEditandoPreparacion(prep.trim().length === 0);
    const paxCargado = row.pax != null && row.pax > 0 ? row.pax : null;
    setPax(paxCargado != null ? String(paxCargado) : "");
    const totalG = sumarGramosTotales(normalizados);
    if (paxCargado != null && totalG > 0) {
      setReferenciaPax(paxCargado);
      setReferenciaGramosTotales(totalG);
    } else {
      setReferenciaPax(paxCargado);
      setReferenciaGramosTotales(totalG > 0 ? totalG : null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarPlatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!platoId) {
      return;
    }
    const timer = window.setTimeout(() => {
      void cargarReceta(platoId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [platoId]);

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
    if (!platoId) {
      setError("Selecciona una receta.");
      return;
    }

    if (platoSeleccionado?.tipo !== "base" && paxNumero === null) {
      setError("Indica el rendimiento en PAX (número mayor que 0).");
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

    const payload = {
      plato_id: platoId,
      pax: paxNumero != null ? Math.round(paxNumero) : null,
      ingredientes: ingredientesPayload.map((fila) => ({
        nombre: fila.nombre,
        gramos: Number(fila.gramosRaw.replace(",", ".")),
      })),
      preparacion: preparacion.trim(),
    };

    const { error: upsertError } = await supabase.from("recetas").upsert(payload, {
      onConflict: "plato_id",
    });

    if (upsertError) {
      setError(formatPostgrestError(upsertError));
      setIsSaving(false);
      return;
    }

    setPreparacionGuardada(preparacion.trim());
    setEditandoPreparacion(false);
    setSuccess(
      `Receta guardada para ${platoSeleccionado?.nombre ?? "el ítem"}.`
    );
    setIsSaving(false);
  };

  const crearBase = async () => {
    const limpio = nombreNuevaBase.trim();
    if (!limpio) {
      setError("Indicá un nombre para la receta base.");
      return;
    }
    const duplicado = platos.some(
      (p) => p.nombre.trim().toLowerCase() === limpio.toLowerCase()
    );
    if (duplicado) {
      setError("Ya existe una receta o plato con ese nombre.");
      return;
    }
    setIsCreatingBase(true);
    setError(null);
    setSuccess(null);
    try {
      const creado = await crearPlatoRecetaBase(limpio);
      setPlatos((actual) =>
        [...actual, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      setPlatoId(creado.id);
      setNombreNuevaBase("");
      setCreandoBase(false);
      setSuccess(`Creada «${creado.nombre}». Completá ingredientes y preparación.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la receta base.");
    } finally {
      setIsCreatingBase(false);
    }
  };

  const borrarBase = async () => {
    if (!platoSeleccionado || platoSeleccionado.tipo !== "base") {
      return;
    }
    if (
      !window.confirm(
        `¿Borrar «${platoSeleccionado.nombre}»? Se elimina la receta base; no afecta platos de carta.`
      )
    ) {
      return;
    }
    setIsDeletingBase(true);
    setError(null);
    setSuccess(null);
    try {
      await borrarPlatoRecetaBase(platoSeleccionado.id);
      setPlatos((actual) => actual.filter((p) => p.id !== platoSeleccionado.id));
      setPlatoId("");
      setSuccess(`Se borró «${platoSeleccionado.nombre}».`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la receta base.");
    } finally {
      setIsDeletingBase(false);
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
            Recetas de platos que servimos y recetas base (dashi, nikiri, etc.) para después
            asociarlas al calendario.
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
        ) : (
          <form onSubmit={guardarReceta} className="space-y-6">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Receta
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCreandoBase((v) => !v);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 transition hover:border-zinc-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva receta base
                </button>
              </div>
              {creandoBase ? (
                <div className="mb-3 flex flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-950/80 p-3 sm:flex-row sm:items-center">
                  <input
                    value={nombreNuevaBase}
                    onChange={(e) => setNombreNuevaBase(e.target.value)}
                    placeholder="Ej. Dashi, Nikiri, Zu…"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void crearBase();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void crearBase()}
                      disabled={isCreatingBase}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-paper disabled:opacity-50"
                    >
                      {isCreatingBase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Crear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreandoBase(false);
                        setNombreNuevaBase("");
                      }}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
              <select
                value={platoId}
                onChange={(e) => {
                  setPlatoId(e.target.value);
                  setSuccess(null);
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
              >
                <option value="">Seleccionar receta…</option>
                {platosBase.length > 0 ? (
                  <optgroup label="Recetas base">
                    {platosBase.map((plato) => (
                      <option key={plato.id} value={plato.id}>
                        {plato.nombre}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {platosCarta.length > 0 ? (
                  <optgroup label="Platos de carta">
                    {platosCarta.map((plato) => (
                      <option key={plato.id} value={plato.id}>
                        {plato.nombre}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {platoSeleccionado?.tipo === "base" ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-500">
                    Receta base: no aparece en el menú ni en Platos. Sí se puede asociar al plan
                    semanal.
                  </p>
                  <button
                    type="button"
                    onClick={() => void borrarBase()}
                    disabled={isDeletingBase}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-500 underline hover:text-red-300 disabled:opacity-50"
                  >
                    {isDeletingBase ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Borrar
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <label className="mb-2 block text-xs uppercase tracking-[0.14em] text-zinc-500">
                Rendimiento — PAX inicial
              </label>
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                {platoSeleccionado?.tipo === "base"
                  ? "Cuánto rinde esta receta (opcional en bases). Después podés recalcular PAX o gramos."
                  : "Cuántas porciones rinden las cantidades en gramos que cargaste (referencia del día). Después podés recalcular PAX o gramos sin reescribir todo a mano."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pax}
                  onChange={(e) => setPax(e.target.value)}
                  placeholder="Ej. 10"
                  disabled={!platoId}
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50"
                  aria-label="PAX inicial, cuánto rinden esas cantidades"
                />
                <button
                  type="button"
                  onClick={recalcularRendimiento}
                  disabled={!platoId}
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
                  disabled={!platoId}
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
                      disabled={!platoId}
                      aria-label={`Ingrediente ${index + 1}`}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-50"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fila.gramos}
                      onChange={(e) => actualizarIngrediente(index, { gramos: e.target.value })}
                      placeholder="0"
                      disabled={!platoId}
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
                      disabled={!platoId}
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
                disabled={!platoId}
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
                {platoId && preparacionGuardada.trim().length > 0 ? (
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
                    disabled={!platoId}
                    rows={10}
                    placeholder="Pasos, tiempos, temperaturas..."
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 disabled:opacity-50"
                  />
                  {platoId && preparacionGuardada.trim().length > 0 ? (
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
              disabled={isSaving || !platoId}
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
