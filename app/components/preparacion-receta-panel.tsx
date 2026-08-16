"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Loader2, Lock } from "lucide-react";

import { RecetaProtegida } from "@/app/components/receta-protegida";
import {
  actualizarVinculoPreparacion,
  type Preparacion,
} from "@/src/lib/preparaciones";
import type { RecetaViewer } from "@/src/lib/receta-acceso";
import {
  fetchRecetaPorPlatoId,
  formatearGramosReceta,
  recetaEstaCompleta,
  recetaTieneIngredientes,
  type PlatoVinculo,
  type RecetaPlato,
} from "@/src/lib/recetas";

type Props = {
  preparacion: Preparacion;
  platos: PlatoVinculo[];
  onCambio: (prep: Preparacion) => void;
  viewer: RecetaViewer | null;
  puedeVer: boolean;
};

export function PreparacionRecetaPanel({
  preparacion,
  platos,
  onCambio,
  viewer,
  puedeVer,
}: Props) {
  const esAdmin = viewer?.role === "admin";
  const [receta, setReceta] = useState<RecetaPlato | null>(null);
  const [cargandoReceta, setCargandoReceta] = useState(false);
  const [procesoDraft, setProcesoDraft] = useState(preparacion.proceso ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProcesoDraft(preparacion.proceso ?? "");
  }, [preparacion.id, preparacion.proceso]);

  useEffect(() => {
    const platoId = preparacion.recetaPlatoId;
    if (!puedeVer || !platoId) {
      setReceta(null);
      return;
    }
    let cancelled = false;
    setCargandoReceta(true);
    setError(null);
    void fetchRecetaPorPlatoId(platoId)
      .then((row) => {
        if (!cancelled) {
          setReceta(row);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReceta(null);
          setError(err instanceof Error ? err.message : "No se pudo cargar la receta.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCargandoReceta(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preparacion.recetaPlatoId, puedeVer]);

  const guardarVinculo = async (platoId: string | null) => {
    if (!esAdmin) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await actualizarVinculoPreparacion(preparacion.id, {
        recetaPlatoId: platoId,
      });
      onCambio(actualizada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la receta.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarProceso = async () => {
    if (!esAdmin) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await actualizarVinculoPreparacion(preparacion.id, {
        proceso: procesoDraft,
      });
      onCambio(actualizada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proceso.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarSoloAdmin = async (valor: boolean) => {
    if (!esAdmin) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await actualizarVinculoPreparacion(preparacion.id, {
        recetaSoloAdmin: valor,
      });
      onCambio(actualizada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el acceso.");
    } finally {
      setGuardando(false);
    }
  };

  const platoVinculado = platos.find((p) => p.id === preparacion.recetaPlatoId) ?? null;
  const conectada = Boolean(preparacion.recetaPlatoId || preparacion.proceso);
  const recetaIncompleta = receta != null && !recetaEstaCompleta(receta);

  if (!puedeVer) {
    return (
      <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/70 p-3">
        <div className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <p>
            {preparacion.recetaSoloAdmin
              ? "La receta de esta preparación es solo de Manu."
              : "La receta de este bloque solo la ve quien lo tiene asignado."}
          </p>
        </div>
      </div>
    );
  }

  const cuerpoReceta = (
    <>
      {receta ? (
        <div className="mb-3 space-y-2">
          {esAdmin && recetaIncompleta ? (
            <p className="text-xs text-amber-200/90">
              Receta incompleta
              {!recetaTieneIngredientes(receta) ? ": faltan ingredientes" : ""}
              {receta.pasos.length === 0 ? ": faltan los pasos" : ""}.{" "}
              <Link
                href={`/receta?plato=${preparacion.recetaPlatoId}`}
                className="underline hover:text-white"
              >
                Completar
              </Link>
            </p>
          ) : null}
          {esAdmin && !recetaIncompleta ? (
            <Link
              href={`/receta?plato=${preparacion.recetaPlatoId}`}
              className="text-xs text-zinc-400 underline hover:text-white"
            >
              Abrir receta completa
            </Link>
          ) : null}
          {receta.pax != null ? (
            <p className="text-[11px] text-zinc-500">Rinde {receta.pax} PAX</p>
          ) : null}
          {recetaTieneIngredientes(receta) ? (
            <ul className="space-y-0.5 text-xs text-zinc-200">
              {receta.ingredientes
                .filter((ing) => ing.nombre.trim())
                .map((ing, i) => (
                  <li key={`${ing.nombre}-${i}`} className="flex justify-between gap-2">
                    <span>{ing.nombre}</span>
                    <span className="shrink-0 tabular-nums text-zinc-400">
                      {formatearGramosReceta(ing.gramos)} g
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
          {receta.pasos ? (
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-900/80 p-2 text-xs leading-relaxed text-zinc-300">
              {receta.pasos}
            </pre>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/70 p-3">
      <div className="mb-2 flex items-center gap-2">
        {conectada ? (
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Receta / proceso
        </p>
      </div>

      {esAdmin && !conectada ? (
        <p className="mb-3 text-xs leading-relaxed text-amber-200/90">
          Esta preparación no está conectada. Asociá una receta de plato o escribí el
          proceso para que aparezca al abrir el bloque.
        </p>
      ) : null}

      {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}

      {esAdmin ? (
        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
            Receta de plato
          </span>
          <select
            value={preparacion.recetaPlatoId ?? ""}
            onChange={(e) => void guardarVinculo(e.target.value || null)}
            disabled={guardando}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Sin receta de plato</option>
            {platos.map((plato) => (
              <option key={plato.id} value={plato.id}>
                {plato.nombre}
                {plato.tieneReceta ? (plato.recetaCompleta ? "" : " (incompleta)") : " (sin receta)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {cargandoReceta ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando receta…
        </p>
      ) : null}

      {esAdmin && preparacion.recetaPlatoId && !cargandoReceta && !receta ? (
        <p className="mb-3 text-xs text-amber-200/90">
          El plato está vinculado pero no tiene receta cargada. Completala en{" "}
          <Link
            href={`/receta?plato=${preparacion.recetaPlatoId}`}
            className="underline hover:text-white"
          >
            Receta
          </Link>
          {platoVinculado ? ` (${platoVinculado.nombre})` : ""}.
        </p>
      ) : null}

      {esAdmin ? (
        cuerpoReceta
      ) : (
        <RecetaProtegida viewerName={viewer?.name ?? "staff"}>
          {cuerpoReceta}
          {preparacion.proceso ? (
            <pre className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-900/80 p-2 text-xs leading-relaxed text-zinc-300">
              {preparacion.proceso}
            </pre>
          ) : null}
        </RecetaProtegida>
      )}

      {esAdmin ? (
        <>
          <label className="mb-3 flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={preparacion.recetaSoloAdmin}
              onChange={(e) => void guardarSoloAdmin(e.target.checked)}
              disabled={guardando}
              className="rounded border-zinc-600"
            />
            Solo Manu puede ver esta receta
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
              Proceso (pasos de esta prep)
            </span>
            <textarea
              value={procesoDraft}
              onChange={(e) => setProcesoDraft(e.target.value)}
              rows={4}
              placeholder="Cómo se hace este bloque: tiempos, temperaturas, mis-en-place…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed"
            />
          </label>
          {procesoDraft !== (preparacion.proceso ?? "") ? (
            <button
              type="button"
              onClick={() => void guardarProceso()}
              disabled={guardando}
              className="mt-2 rounded-lg border border-emerald-700/70 bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar proceso"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
