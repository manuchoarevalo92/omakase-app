"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen } from "lucide-react";

import { RecetaProtegida } from "@/app/components/receta-protegida";
import { Interruptor } from "@/app/ui";
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
            <p className="text-[0.86rem] leading-snug text-warning">
              Receta incompleta
              {!recetaTieneIngredientes(receta) ? ": faltan ingredientes" : ""}
              {receta.pasos.length === 0 ? ": faltan los pasos" : ""}.{" "}
              <Link href={hrefReceta} className="font-semibold underline">
                Completar
              </Link>
            </p>
          ) : null}
          {esAdmin && !recetaIncompleta ? (
            <Link
              href={hrefReceta}
              className="inline-flex min-h-11 items-center text-[0.9rem] font-semibold text-accent"
            >
              Abrir receta completa
            </Link>
          ) : null}
          {receta.pax != null ? (
            <p className="text-[0.8rem] text-label-3">Rinde {receta.pax} PAX</p>
          ) : null}
          {recetaTieneIngredientes(receta) ? (
            <ul className="space-y-1 text-[0.9rem] text-label">
              {receta.ingredientes
                .filter((ing) => ing.nombre.trim())
                .map((ing, i) => (
                  <li
                    key={`${ing.nombre}-${i}`}
                    className="flex justify-between gap-2"
                  >
                    <span>{ing.nombre}</span>
                    <span className="shrink-0 tabular-nums text-label-2">
                      {formatearGramosReceta(ing.gramos)} g
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
          {receta.pasos ? (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-control bg-fill p-3 font-sans text-[0.86rem] leading-relaxed text-label-2">
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
    <div className="rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="mb-2 flex items-center gap-2">
        {conectada ? (
          <BookOpen className="h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden
          />
        )}
        <p className="text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
          Receta / proceso
        </p>
      </div>

      {esAdmin && !conectada ? (
        <p className="mb-3 text-[0.86rem] leading-snug text-warning">
          Esta preparación todavía no tiene receta. Cargala en{" "}
          <Link href={hrefReceta} className="font-semibold underline">
            Recetas y procesos
          </Link>
          .
        </p>
      ) : null}

      {esAdmin &&
      preparacion.recetaPlatoId &&
      !preparacionTieneIngredientesReceta(preparacion) &&
      !preparacion.proceso ? (
        <p className="mb-3 text-[0.86rem] leading-snug text-warning">
          Había un vínculo viejo a un plato. Completá la receta en{" "}
          <Link href={hrefReceta} className="font-semibold underline">
            Recetas y procesos
          </Link>
          .
        </p>
      ) : null}

      {esAdmin ? (
        cuerpoReceta
      ) : (
        <RecetaProtegida viewerName={viewer?.name ?? "staff"}>
          {cuerpoReceta}
        </RecetaProtegida>
      )}

      {esAdmin ? (
        <label className="flex min-h-11 items-center justify-between gap-3 border-t border-separator pt-2 text-[0.9rem] text-label-2">
          Solo Manu puede ver esta receta
          <Interruptor
            etiqueta="Solo Manu puede ver esta receta"
            activo={preparacion.recetaSoloAdmin}
            onChange={(v) => void guardarSoloAdmin(v)}
          />
        </label>
      ) : null}
    </div>
  );
}
