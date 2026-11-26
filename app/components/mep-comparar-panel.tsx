"use client";

import { useMemo } from "react";
import { X } from "lucide-react";

import {
  BotonIcono,
  Seccion,
  Selector,
  cx,
  type OpcionSelector,
} from "@/app/ui";
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

const TONO_RESULTADO = {
  falto: "text-danger",
  sobro: "text-warning",
  ok: "text-success",
} as const;

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
    <article className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <header className="flex items-center gap-3 border-b border-separator px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.9rem] font-bold text-accent">
          {titulo}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] font-semibold text-label">
            {etiquetaCargaMep(carga)}
          </span>
          {carga.cargado_por_nombre ? (
            <span className="block truncate text-[0.86rem] text-label-3">
              Cargada por {carga.cargado_por_nombre}
            </span>
          ) : null}
        </span>
      </header>

      <ul>
        {lineas.map((l) => (
          <li
            key={l.corte_id}
            className="flex items-baseline gap-3 border-b border-separator px-4 py-2 last:border-0"
          >
            <span className="min-w-0 flex-1 text-[0.94rem] leading-snug text-label">
              {l.nombre}
              <span className="ml-1.5 text-[0.8rem] text-label-3">
                {l.categoria}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[0.97rem] font-semibold tabular-nums text-label">
              {l.cantidad}
              <span className="ml-1 font-sans text-[0.8rem] font-normal text-label-3">
                {etiquetaUnidadMep(l.unidad)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-separator px-4 py-3">
        <p className="mb-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
          Cierre
        </p>
        {!tieneCierre(carga) ? (
          <p className="text-[0.94rem] text-label-3">Sin cerrar</p>
        ) : (
          <ul className="space-y-1">
            {cierre.map((l) => (
              <li
                key={l.corte_id}
                className="flex items-baseline gap-3 text-[0.9rem]"
              >
                <span className="min-w-0 flex-1 text-label-2">{l.nombre}</span>
                <span
                  className={cx(
                    "shrink-0 font-semibold",
                    TONO_RESULTADO[l.resultado],
                  )}
                >
                  {etiquetaResultadoCierre(l.resultado)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
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
  const { cargas, cortesPorId, idA, idB, onCambiarA, onCambiarB, onCerrar } =
    props;

  const opciones = useMemo(
    () =>
      [...cargas].sort(
        (a, b) =>
          b.fecha.localeCompare(a.fecha) ||
          b.created_at.localeCompare(a.created_at),
      ),
    [cargas],
  );

  const opcionesSelector: OpcionSelector<string>[] = useMemo(
    () =>
      opciones.map((c) => ({
        valor: c.id,
        label: etiquetaCargaMep(c),
        detalle: c.cargado_por_nombre ?? undefined,
      })),
    [opciones],
  );

  const cargaA = opciones.find((c) => c.id === idA) ?? null;
  const cargaB = opciones.find((c) => c.id === idB) ?? null;

  return (
    <Seccion
      titulo="Comparar servicios"
      accion={
        <BotonIcono
          etiqueta="Cerrar comparación"
          variante="plano"
          icono={<X className="h-5 w-5" aria-hidden />}
          onClick={onCerrar}
        />
      }
      className="mb-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <Selector
          label="Servicio A"
          valor={idA}
          opciones={opcionesSelector}
          onChange={onCambiarA}
          buscar={opcionesSelector.length > 10}
        />
        <Selector
          label="Servicio B"
          valor={idB}
          opciones={opcionesSelector}
          onChange={onCambiarB}
          buscar={opcionesSelector.length > 10}
        />
      </div>
      {cargaA && cargaB ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <BloqueCarga titulo="A" carga={cargaA} cortesPorId={cortesPorId} />
          <BloqueCarga titulo="B" carga={cargaB} cortesPorId={cortesPorId} />
        </div>
      ) : null}
      {cargaA && cargaB ? null : (
        <p className="mt-3 px-1 text-[0.9rem] text-label-3">
          Elegí los dos servicios para compararlos.
        </p>
      )}
    </Seccion>
  );
}
