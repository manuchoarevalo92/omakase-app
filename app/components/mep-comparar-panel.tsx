"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

import {
  enriquecerCierreLineas,
  enriquecerLineasMep,
  etiquetaCargaMep,
  etiquetaResultadoCierre,
  etiquetaUnidadMep,
  tieneCierre,
  type MepCorte,
  type MepDeliCarga,
} from "@/src/lib/mep-deli";

function BloqueCarga(props: {
  titulo: string;
  carga: MepDeliCarga;
  cortesPorId: Map<string, MepCorte>;
}) {
  const { titulo, carga, cortesPorId } = props;
  const lineas = enriquecerLineasMep(carga.lineas, cortesPorId);
  const cierre = tieneCierre(carga)
    ? enriquecerCierreLineas(carga, cortesPorId)
    : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <h3 className="mb-2 text-sm font-medium text-zinc-100">{titulo}</h3>
      <p className="mb-3 text-xs text-zinc-500">{etiquetaCargaMep(carga)}</p>
      {carga.cargado_por_nombre ? (
        <p className="mb-2 text-xs text-zinc-500">
          Cargada por <span className="text-zinc-300">{carga.cargado_por_nombre}</span>
        </p>
      ) : null}
      <ul className="mb-3 space-y-1 text-sm">
        {lineas.map((l) => (
          <li key={l.corte_id}>
            <span className="text-zinc-500">{l.categoria} ·</span> {l.nombre}:{" "}
            <span className="text-white">
              {l.cantidad} {etiquetaUnidadMep(l.unidad)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Cierre
      </p>
      {!tieneCierre(carga) ? (
        <p className="text-xs text-zinc-500">Sin cerrar</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {cierre.map((l) => (
            <li key={l.corte_id}>
              {l.categoria} · {l.nombre}:{" "}
              <span
                className={
                  l.resultado === "falto"
                    ? "text-red-300"
                    : l.resultado === "sobro"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }
              >
                {etiquetaResultadoCierre(l.resultado)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MepCompararPanel(props: {
  cargas: MepDeliCarga[];
  cortesPorId: Map<string, MepCorte>;
  idA: string;
  idB: string;
  onCambiarA: (id: string) => void;
  onCambiarB: (id: string) => void;
  onCerrar: () => void;
}) {
  const { cargas, cortesPorId, idA, idB, onCambiarA, onCambiarB, onCerrar } = props;

  const opciones = useMemo(
    () =>
      [...cargas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)),
    [cargas]
  );

  const cargaA = opciones.find((c) => c.id === idA) ?? null;
  const cargaB = opciones.find((c) => c.id === idB) ?? null;

  return (
    <section className="mb-6 rounded-xl border border-violet-900/40 bg-violet-950/15 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-300">
          Comparar servicios
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
          Cerrar
        </button>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-zinc-500">
          Servicio A
          <select
            value={idA}
            onChange={(e) => onCambiarA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaCargaMep(c)}
                {c.cargado_por_nombre ? ` · ${c.cargado_por_nombre}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-500">
          Servicio B
          <select
            value={idB}
            onChange={(e) => onCambiarB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaCargaMep(c)}
                {c.cargado_por_nombre ? ` · ${c.cargado_por_nombre}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {cargaA && cargaB ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <BloqueCarga titulo="A" carga={cargaA} cortesPorId={cortesPorId} />
          <BloqueCarga titulo="B" carga={cargaB} cortesPorId={cortesPorId} />
        </div>
      ) : null}
    </section>
  );
}
