"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen } from "lucide-react";

import { RecetaProtegida } from "@/app/components/receta-protegida";
import {
  actualizarVinculoPreparacion,
  preparacionEstaConectada,
  preparacionTieneIngredientesReceta,
  type Preparacion,
} from "@/src/lib/preparaciones";
import type { RecetaViewer } from "@/src/lib/receta-acceso";
import {
  formatearGramosReceta,
  recetaDesdeCampos,
  recetaEstaCompleta,
  recetaTieneIngredientes,
} from "@/src/lib/recetas";

type Props = {
  preparacion: Preparacion;
  onCambio: (prep: Preparacion) => void;
  viewer: RecetaViewer | null;
  puedeVer: boolean;
};

export function PreparacionRecetaPanel({
  preparacion,
  onCambio,
  viewer,
  puedeVer,
}: Props) {
  const esAdmin = viewer?.role === "admin";
  const receta = recetaDesdeCampos({
    ingredientes: preparacion.recetaIngredientes,
    pasos: preparacion.proceso,
    pax: preparacion.recetaPax,
  });
  const conectada = preparacionEstaConectada(preparacion);
  const recetaIncompleta = conectada && !recetaEstaCompleta(receta);
  const hrefReceta = `/receta?prep=${preparacion.id}`;

  if (!puedeVer) {
    return null;
  }

  const cuerpoReceta = (
    <>
      {conectada ? (
        <div className="mb-3 space-y-2">
          {esAdmin && recetaIncompleta ? (
            <p className="text-xs text-amber-200/90">
              Receta incompleta
              {!recetaTieneIngredientes(receta) ? ": faltan ingredientes" : ""}
              {receta.pasos.length === 0 ? ": faltan los pasos" : ""}.{" "}
              <Link href={hrefReceta} className="underline hover:text-white">
                Completar
              </Link>
            </p>
          ) : null}
          {esAdmin && !recetaIncompleta ? (
            <Link
              href={hrefReceta}
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

  const guardarSoloAdmin = async (valor: boolean) => {
    if (!esAdmin) {
      return;
    }
    try {
      const actualizada = await actualizarVinculoPreparacion(preparacion.id, {
        recetaSoloAdmin: valor,
      });
      onCambio(actualizada);
    } catch {
      /* el padre muestra errores de carga; acá no bloqueamos la vista */
    }
  };

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
          Esta preparación todavía no tiene receta. Cargala en{" "}
          <Link href={hrefReceta} className="underline hover:text-white">
            Recetas y procesos
          </Link>
          .
        </p>
      ) : null}

      {esAdmin &&
      preparacion.recetaPlatoId &&
      !preparacionTieneIngredientesReceta(preparacion) &&
      !preparacion.proceso ? (
        <p className="mb-3 text-xs text-amber-200/90">
          Había un vínculo viejo a un plato. Completá la receta en{" "}
          <Link href={hrefReceta} className="underline hover:text-white">
            Recetas y procesos
          </Link>
          .
        </p>
      ) : null}

      {esAdmin ? (
        cuerpoReceta
      ) : (
        <RecetaProtegida viewerName={viewer?.name ?? "staff"}>{cuerpoReceta}</RecetaProtegida>
      )}

      {esAdmin ? (
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={preparacion.recetaSoloAdmin}
            onChange={(e) => void guardarSoloAdmin(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Solo Manu puede ver esta receta
        </label>
      ) : null}
    </div>
  );
}
