"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";

import { fetchSessionUsuario } from "@/src/lib/produccion-sesiones";
import {
  crearPersonalRegistro,
  eliminarPersonalRegistro,
  ETIQUETA_TIPO_MOVIMIENTO,
  fetchPersonalRegistros,
  PERSONAL_PERSONAS,
  nombrePersonalFicha,
  PERSONAL_TIPO_MOVIMIENTO,
  type PersonalRegistro,
  type PersonalTipoMovimiento,
} from "@/src/lib/personal-fichas";

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatearEuros(v: number): string {
  return v.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function PersonalPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permisoOk, setPermisoOk] = useState(false);
  const [registros, setRegistros] = useState<PersonalRegistro[]>([]);

  const [personaId, setPersonaId] = useState(PERSONAL_PERSONAS[0]?.id ?? "manu");
  const [tipo, setTipo] = useState<PersonalTipoMovimiento>("vacaciones");
  const [fecha, setFecha] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState("");
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("");

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [sessionRes, usuario] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetchSessionUsuario(),
        ]);
        const sessionJson = (await sessionRes.json()) as {
          session: { id: string; role: "admin" | "staff" } | null;
        };
        if (!sessionJson.session || sessionJson.session.role !== "admin") {
          if (!cancelado) {
            setPermisoOk(false);
            setError("Solo Manu puede ver esta sección.");
          }
          return;
        }
        if (!cancelado) {
          setPermisoOk(true);
          setPersonaId(PERSONAL_PERSONAS[0]?.id ?? usuario?.id ?? "manu");
          setRegistros(await fetchPersonalRegistros());
        }
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudo cargar personal.");
        }
      } finally {
        if (!cancelado) {
          setIsLoading(false);
        }
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const visibles = useMemo(() => {
    if (!filtroPersona) return registros;
    return registros.filter((r) => r.personaId === filtroPersona);
  }, [registros, filtroPersona]);

  const resumenMes = useMemo(() => {
    const yyyyMm = hoyISO().slice(0, 7);
    const base = new Map(
      PERSONAL_PERSONAS.map((p) => [p.id, { efectivo: 0, transferencia: 0, propina: 0 }])
    );
    for (const r of registros) {
      if (!r.fecha.startsWith(yyyyMm)) continue;
      const acc = base.get(r.personaId);
      if (!acc || r.monto == null) continue;
      if (r.tipo === "cobro_efectivo") acc.efectivo += r.monto;
      if (r.tipo === "cobro_transferencia") acc.transferencia += r.monto;
      if (r.tipo === "extra_propina") acc.propina += r.monto;
    }
    return base;
  }, [registros]);

  const guardar = async () => {
    if (!permisoOk) return;
    if (!personaId || !fecha) {
      setError("Completá persona y fecha.");
      return;
    }
    const montoN = monto.trim() ? Number(monto.replace(",", ".")) : null;
    if (montoN != null && (!Number.isFinite(montoN) || montoN < 0)) {
      setError("Monto inválido.");
      return;
    }
    if (tipo === "vacaciones" && fechaHasta && fechaHasta < fecha) {
      setError("La fecha hasta no puede ser anterior a la fecha inicial.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const u = await fetchSessionUsuario();
      const nuevo = await crearPersonalRegistro({
        personaId,
        tipo,
        fecha,
        fechaHasta: tipo === "vacaciones" ? fechaHasta || null : null,
        monto: tipo === "vacaciones" ? null : montoN,
        notas,
        creadoPorId: u?.id ?? null,
        creadoPorNombre: u?.name ?? null,
      });
      setRegistros((prev) => [nuevo, ...prev]);
      setMonto("");
      setNotas("");
      setFechaHasta("");
      setSuccess("Registro guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrar = async (id: string) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    setIsBusy(true);
    setError(null);
    try {
      await eliminarPersonalRegistro(id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      setSuccess("Registro eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Personal</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Fichas internas: vacaciones, cobros en efectivo/transferencia y extras por propinas.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {success && !error ? (
          <p className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : !permisoOk ? null : (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PERSONAL_PERSONAS.map((p) => {
                const r = resumenMes.get(p.id)!;
                return (
                  <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white">
                      <UserRound className="h-4 w-4 text-zinc-500" />
                      {p.name}
                      {!p.esStaff ? (
                        <span className="rounded-md border border-amber-800/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90">
                          Apoyo delivery
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Efectivo: <span className="text-zinc-200">{formatearEuros(r.efectivo)}€</span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Transferencia:{" "}
                      <span className="text-zinc-200">{formatearEuros(r.transferencia)}€</span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Propinas: <span className="text-zinc-200">{formatearEuros(r.propina)}€</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-300">Agregar registro</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-zinc-500">
                  Persona
                  <select
                    value={personaId}
                    onChange={(e) => setPersonaId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    <optgroup label="Equipo">
                      {PERSONAL_PERSONAS.filter((p) => p.esStaff).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Apoyo">
                      {PERSONAL_PERSONAS.filter((p) => !p.esStaff).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="text-xs text-zinc-500">
                  Tipo
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as PersonalTipoMovimiento)}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    {PERSONAL_TIPO_MOVIMIENTO.map((t) => (
                      <option key={t} value={t}>
                        {ETIQUETA_TIPO_MOVIMIENTO[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-500">
                  Fecha
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  />
                </label>
                {tipo === "vacaciones" ? (
                  <label className="text-xs text-zinc-500">
                    Fecha hasta
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    />
                  </label>
                ) : (
                  <label className="text-xs text-zinc-500">
                    Monto (€)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    />
                  </label>
                )}
              </div>
              <label className="mt-3 block text-xs text-zinc-500">
                Notas
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={isBusy}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2 text-sm font-semibold text-emerald-50 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Guardar
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-300">Registros</p>
              <select
                value={filtroPersona}
                onChange={(e) => setFiltroPersona(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white"
              >
                <option value="">Todas las personas</option>
                {PERSONAL_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Persona</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Hasta</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Notas</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800 text-zinc-200">
                      <td className="px-3 py-2">{nombrePersonalFicha(r.personaId)}</td>
                      <td className="px-3 py-2">{ETIQUETA_TIPO_MOVIMIENTO[r.tipo]}</td>
                      <td className="px-3 py-2 tabular-nums">{r.fecha}</td>
                      <td className="px-3 py-2 tabular-nums">{r.fechaHasta ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.monto != null ? `${formatearEuros(r.monto)}€` : "—"}
                      </td>
                      <td className="px-3 py-2">{r.notas ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void borrar(r.id)}
                          className="rounded-md border border-zinc-700 p-1 text-zinc-400 hover:text-zinc-100"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
