"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  ClipboardList,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Boton,
  BotonIcono,
  Campo,
  EsqueletoLista,
  EstadoVacio,
  Etiqueta,
  Fecha,
  Pantalla,
  Seccion,
  Selector,
  useAvisos,
  type OpcionSelector,
} from "@/app/ui";

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

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** YYYY-MM-DD → "12 mar 2026" (solo para mostrar). */
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MESES[m - 1]} ${y}`;
}

const OPCIONES_PERSONA: OpcionSelector<string>[] = PERSONAL_PERSONAS.map(
  (p) => ({
    valor: p.id,
    label: p.name,
    grupo: p.esStaff ? "Equipo" : "Apoyo",
  }),
).sort((a, b) => (a.grupo === b.grupo ? 0 : a.grupo === "Equipo" ? -1 : 1));

const OPCIONES_TIPO: OpcionSelector<PersonalTipoMovimiento>[] =
  PERSONAL_TIPO_MOVIMIENTO.map((t) => ({
    valor: t,
    label: ETIQUETA_TIPO_MOVIMIENTO[t],
  }));

export default function PersonalPage() {
  const { aviso, confirmar } = useAvisos();
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permisoOk, setPermisoOk] = useState(false);
  const [registros, setRegistros] = useState<PersonalRegistro[]>([]);

  const [personaId, setPersonaId] = useState(
    PERSONAL_PERSONAS[0]?.id ?? "manu",
  );
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
          setError(
            err instanceof Error ? err.message : "No se pudo cargar personal.",
          );
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
      PERSONAL_PERSONAS.map((p) => [
        p.id,
        { efectivo: 0, transferencia: 0, propina: 0 },
      ]),
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
      aviso("Registro guardado.", { tono: "exito" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrar = async (id: string) => {
    const ok = await confirmar({
      titulo: "¿Eliminar este registro?",
      texto: "No se puede deshacer.",
      confirmar: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setIsBusy(true);
    setError(null);
    try {
      await eliminarPersonalRegistro(id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      aviso("Registro eliminado.", { tono: "exito" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Pantalla
      titulo="Personal"
      subtitulo={
        isLoading
          ? "Cargando…"
          : permisoOk
            ? `${registros.length} ${registros.length === 1 ? "registro" : "registros"}`
            : undefined
      }
      ancho="amplio"
      ayuda={
        <p>
          Fichas internas: vacaciones, cobros en efectivo o transferencia y
          extras por propinas. El resumen de arriba suma los montos del mes en
          curso.
        </p>
      }
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : !permisoOk ? null : (
        <>
          <Seccion titulo="Este mes">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PERSONAL_PERSONAS.map((p) => {
                const r = resumenMes.get(p.id)!;
                return (
                  <div
                    key={p.id}
                    className="min-w-0 rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-[1rem] font-semibold text-label">
                      <UserRound
                        className="h-[18px] w-[18px] text-label-3"
                        aria-hidden
                      />
                      {p.name}
                      {!p.esStaff ? (
                        <Etiqueta tono="alerta">Apoyo delivery</Etiqueta>
                      ) : null}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2">
                      <div className="min-w-0">
                        <dt className="text-[0.8rem] text-label-3">Efectivo</dt>
                        <dd className="text-[1.05rem] font-semibold tabular-nums text-label">
                          {formatearEuros(r.efectivo)}€
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[0.8rem] text-label-3">Transf.</dt>
                        <dd className="text-[1.05rem] font-semibold tabular-nums text-label">
                          {formatearEuros(r.transferencia)}€
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[0.8rem] text-label-3">Propinas</dt>
                        <dd className="text-[1.05rem] font-semibold tabular-nums text-label">
                          {formatearEuros(r.propina)}€
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </Seccion>

          <Seccion titulo="Agregar registro">
            <div className="space-y-3 rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Selector
                  label="Persona"
                  titulo="Elegir persona"
                  opciones={OPCIONES_PERSONA}
                  valor={personaId}
                  onChange={setPersonaId}
                />
                <Selector
                  label="Tipo"
                  titulo="Tipo de registro"
                  opciones={OPCIONES_TIPO}
                  valor={tipo}
                  onChange={setTipo}
                />
                <Fecha
                  label={tipo === "vacaciones" ? "Desde" : "Fecha"}
                  valor={fecha}
                  onChange={setFecha}
                />
                {tipo === "vacaciones" ? (
                  <Campo
                    type="date"
                    label="Hasta (opcional)"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                ) : (
                  <Campo
                    type="text"
                    inputMode="decimal"
                    label="Monto (€)"
                    placeholder="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                )}
              </div>
              <Campo
                type="text"
                label="Notas"
                placeholder="Opcional"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
              <Boton
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                cargando={isBusy}
                onClick={() => void guardar()}
                className="w-full sm:w-auto"
              >
                Guardar registro
              </Boton>
            </div>
          </Seccion>

          <Seccion titulo="Registros">
            <div className="mb-3 sm:max-w-xs">
              <Selector
                titulo="Filtrar por persona"
                opciones={OPCIONES_PERSONA}
                valor={filtroPersona}
                onChange={setFiltroPersona}
                placeholder="Todas las personas"
                vaciar={{ valor: "", label: "Todas las personas" }}
              />
            </div>
            {visibles.length === 0 ? (
              <EstadoVacio
                icono={<ClipboardList className="h-6 w-6" aria-hidden />}
                titulo="Sin registros"
                texto={
                  filtroPersona
                    ? "Esta persona no tiene registros cargados."
                    : "Todavía no se cargó ningún registro."
                }
              />
            ) : (
              <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                {visibles.map((r) => (
                  <li
                    key={r.id}
                    className="flex min-h-14 items-center gap-3 border-b border-separator pl-4 pr-1.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1 py-3">
                      <p className="text-[1rem] leading-snug text-label">
                        <span className="font-medium">
                          {nombrePersonalFicha(r.personaId)}
                        </span>
                        <span className="text-label-3"> · </span>
                        {ETIQUETA_TIPO_MOVIMIENTO[r.tipo]}
                      </p>
                      <p className="mt-0.5 text-[0.86rem] tabular-nums text-label-3">
                        {fechaCorta(r.fecha)}
                        {r.fechaHasta ? ` → ${fechaCorta(r.fechaHasta)}` : ""}
                      </p>
                      {r.notas ? (
                        <p className="mt-0.5 text-[0.86rem] text-label-2">
                          {r.notas}
                        </p>
                      ) : null}
                    </div>
                    {r.monto != null ? (
                      <span className="shrink-0 text-[1rem] font-semibold tabular-nums text-label">
                        {formatearEuros(r.monto)}€
                      </span>
                    ) : null}
                    <BotonIcono
                      etiqueta="Eliminar registro"
                      variante="plano"
                      disabled={isBusy}
                      onClick={() => void borrar(r.id)}
                      icono={
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}
