"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  actualizarMepDeliCarga,
  cierreInicialDesdeCarga,
  enriquecerCierreLineas,
  etiquetaResultadoCierre,
  etiquetaUnidadMep,
  fetchSessionMepUsuario,
  normalizarCierreLineas,
  tieneCierre,
  type MepDeliCarga,
  type MepLineaCierre,
  type MepResultadoCierre,
  type MepCorte,
} from "@/src/lib/mep-deli";

const RESULTADOS: MepResultadoCierre[] = ["ok", "falto", "sobro"];

function claseBotonResultado(
  resultado: MepResultadoCierre,
  activo: boolean,
): string {
  const base = "rounded-lg px-2.5 py-1 text-xs font-medium transition border";
  if (!activo) {
    return `${base} border-separator bg-fill text-label-3 hover:border-label-3 hover:text-label`;
  }
  if (resultado === "falto") {
    return `${base} border-red-800 bg-red-950/60 text-red-200`;
  }
  if (resultado === "sobro") {
    return `${base} border-amber-800 bg-amber-950/50 text-amber-200`;
  }
  return `${base} border-emerald-800 bg-emerald-950/50 text-emerald-200`;
}

export function MepCierrePanel(props: {
  carga: MepDeliCarga;
  cortesPorId: Map<string, MepCorte>;
  onCierreGuardado: (carga: MepDeliCarga) => void;
}) {
  const { carga, cortesPorId, onCierreGuardado } = props;
  const [lineas, setLineas] = useState<MepLineaCierre[]>(() =>
    cierreInicialDesdeCarga(carga),
  );
  const [abierto, setAbierto] = useState(!tieneCierre(carga));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lineasUi = useMemo(() => {
    const tmp: MepDeliCarga = { ...carga, cierre_lineas: lineas };
    return enriquecerCierreLineas(tmp, cortesPorId);
  }, [carga, lineas, cortesPorId]);

  const actualizarLinea = (corteId: string, patch: Partial<MepLineaCierre>) => {
    setLineas((prev) =>
      prev.map((l) => (l.corte_id === corteId ? { ...l, ...patch } : l)),
    );
    setError(null);
    setSuccess(null);
  };

  const marcarTodosOk = () => {
    setLineas((prev) =>
      prev.map((l) => ({
        ...l,
        resultado: "ok",
        cantidad: undefined,
        nota: undefined,
      })),
    );
  };

  const guardarCierre = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const usuario = await fetchSessionMepUsuario();
    const cierreLineas = normalizarCierreLineas(lineas);

    try {
      const actualizada = await actualizarMepDeliCarga(carga.id, {
        cierre_lineas: cierreLineas,
        cierre_at: new Date().toISOString(),
        cerrado_por_id: usuario?.id ?? null,
        cerrado_por_nombre: usuario?.name ?? null,
      });
      onCierreGuardado(actualizada);
      setLineas(cierreInicialDesdeCarga(actualizada));
      setAbierto(false);
      setSuccess("Cierre guardado.");
      setIsSaving(false);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(
              err as Parameters<typeof formatPostgrestError>[0],
            )
          : "No se pudo guardar el cierre.",
      );
      setIsSaving(false);
    }
  };

  if (tieneCierre(carga) && !abierto) {
    const cerradas = enriquecerCierreLineas(carga, cortesPorId);
    const conVarianza = cerradas.filter((l) => l.resultado !== "ok");

    return (
      <div className="mt-4 rounded-xl border border-separator bg-surface-3 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-label-3">
            Cierre de servicio
          </p>
          <button
            type="button"
            onClick={() => {
              setLineas(cierreInicialDesdeCarga(carga));
              setAbierto(true);
              setSuccess(null);
            }}
            className="text-xs text-label-2 underline hover:text-label"
          >
            Editar cierre
          </button>
        </div>
        {carga.cerrado_por_nombre ? (
          <p className="mb-2 text-xs text-label-3">
            Cerrado por{" "}
            <span className="text-label-2">{carga.cerrado_por_nombre}</span>
          </p>
        ) : null}
        {conVarianza.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-300/90">
            <CheckCircle2 className="h-4 w-4" />
            Todo OK — nada faltó ni sobró.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {conVarianza.map((l) => (
              <li key={l.corte_id}>
                <span className="text-label-3">{l.categoria} ·</span> {l.nombre}
                :{" "}
                <span
                  className={
                    l.resultado === "falto" ? "text-red-300" : "text-amber-300"
                  }
                >
                  {etiquetaResultadoCierre(l.resultado)}
                  {l.cantidad
                    ? ` (${l.cantidad} ${etiquetaUnidadMep(l.unidad)})`
                    : ""}
                </span>
                {l.nota ? (
                  <span className="text-label-3"> — {l.nota}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-sky-200">
          Cerrar MEP del servicio
        </p>
        <button
          type="button"
          onClick={marcarTodosOk}
          className="text-xs text-label-2 underline hover:text-label"
        >
          Marcar todo OK
        </button>
      </div>
      <p className="mb-4 text-xs text-label-2">
        Al final del servicio: ¿faltó o sobró algo respecto a lo preparado?
      </p>

      <ul className="space-y-3">
        {lineasUi.map((l) => (
          <li
            key={l.corte_id}
            className="rounded-lg border border-separator/80 bg-surface-3 px-3 py-2.5"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-label">
                <span className="text-label-3">{l.categoria} ·</span> {l.nombre}
              </span>
              <span className="text-xs text-label-3">
                Plan: {l.cantidad_plan} {etiquetaUnidadMep(l.unidad)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    actualizarLinea(l.corte_id, {
                      resultado: r,
                      ...(r === "ok"
                        ? { cantidad: undefined, nota: undefined }
                        : {}),
                    })
                  }
                  className={claseBotonResultado(r, l.resultado === r)}
                >
                  {etiquetaResultadoCierre(r)}
                </button>
              ))}
              {(l.resultado === "falto" || l.resultado === "sobro") && (
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Cant."
                  value={l.cantidad ?? ""}
                  onChange={(e) =>
                    actualizarLinea(l.corte_id, {
                      cantidad: e.target.value || undefined,
                    })
                  }
                  className="w-20 rounded-lg border border-separator bg-fill px-2 py-1 text-right text-xs text-label outline-none focus:border-accent"
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-300">{success}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void guardarCierre()}
        disabled={isSaving}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar cierre
      </button>
    </div>
  );
}
