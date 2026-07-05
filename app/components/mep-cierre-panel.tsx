"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  MEP_CARGA_SELECT,
  cargaDesdeFila,
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
import { supabase } from "@/src/lib/supabase";

const RESULTADOS: MepResultadoCierre[] = ["ok", "falto", "sobro"];

function claseBotonResultado(resultado: MepResultadoCierre, activo: boolean): string {
  const base =
    "rounded-lg px-2.5 py-1 text-xs font-medium transition border";
  if (!activo) {
    return `${base} border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300`;
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
  const [lineas, setLineas] = useState<MepLineaCierre[]>(() => cierreInicialDesdeCarga(carga));
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
      prev.map((l) => (l.corte_id === corteId ? { ...l, ...patch } : l))
    );
    setError(null);
    setSuccess(null);
  };

  const marcarTodosOk = () => {
    setLineas((prev) => prev.map((l) => ({ ...l, resultado: "ok", cantidad: undefined, nota: undefined })));
  };

  const guardarCierre = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const usuario = await fetchSessionMepUsuario();
    const cierreLineas = normalizarCierreLineas(lineas);

    const { data, error: saveError } = await supabase
      .from("mep_deli_cargas")
      .update({
        cierre_lineas: cierreLineas,
        cierre_at: new Date().toISOString(),
        cerrado_por_id: usuario?.id ?? null,
        cerrado_por_nombre: usuario?.name ?? null,
      })
      .eq("id", carga.id)
      .select(MEP_CARGA_SELECT)
      .single();

    if (saveError) {
      setError(formatPostgrestError(saveError));
      setIsSaving(false);
      return;
    }

    const actualizada = cargaDesdeFila(data);
    onCierreGuardado(actualizada);
    setLineas(cierreInicialDesdeCarga(actualizada));
    setAbierto(false);
    setSuccess("Cierre guardado.");
    setIsSaving(false);
  };

  if (tieneCierre(carga) && !abierto) {
    const cerradas = enriquecerCierreLineas(carga, cortesPorId);
    const conVarianza = cerradas.filter((l) => l.resultado !== "ok");

    return (
      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Cierre de servicio
          </p>
          <button
            type="button"
            onClick={() => {
              setLineas(cierreInicialDesdeCarga(carga));
              setAbierto(true);
              setSuccess(null);
            }}
            className="text-xs text-zinc-400 underline hover:text-zinc-200"
          >
            Editar cierre
          </button>
        </div>
        {carga.cerrado_por_nombre ? (
          <p className="mb-2 text-xs text-zinc-500">
            Cerrado por <span className="text-zinc-300">{carga.cerrado_por_nombre}</span>
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
                <span className="text-zinc-500">{l.categoria} ·</span> {l.nombre}:{" "}
                <span
                  className={
                    l.resultado === "falto" ? "text-red-300" : "text-amber-300"
                  }
                >
                  {etiquetaResultadoCierre(l.resultado)}
                  {l.cantidad ? ` (${l.cantidad} ${etiquetaUnidadMep(l.unidad)})` : ""}
                </span>
                {l.nota ? (
                  <span className="text-zinc-500"> — {l.nota}</span>
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
        <p className="text-sm font-medium text-sky-200">Cerrar MEP del servicio</p>
        <button
          type="button"
          onClick={marcarTodosOk}
          className="text-xs text-zinc-400 underline hover:text-zinc-200"
        >
          Marcar todo OK
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        Al final del servicio: ¿faltó o sobró algo respecto a lo preparado?
      </p>

      <ul className="space-y-3">
        {lineasUi.map((l) => (
          <li
            key={l.corte_id}
            className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-zinc-100">
                <span className="text-zinc-500">{l.categoria} ·</span> {l.nombre}
              </span>
              <span className="text-xs text-zinc-500">
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
                      ...(r === "ok" ? { cantidad: undefined, nota: undefined } : {}),
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
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs text-zinc-100 outline-none focus:border-zinc-500"
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-300">{success}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void guardarCierre()}
        disabled={isSaving}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar cierre
      </button>
    </div>
  );
}
