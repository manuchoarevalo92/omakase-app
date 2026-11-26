"use client";

import { useMemo, useRef, useState } from "react";

import { IlustracionPaso } from "./ilustraciones";
import { PROCESOS, type Efecto, type Paso, type Proceso, type Termino } from "./procesos-data";

type PasoVista = {
  clave: string;
  /** Clave del dibujo dentro del proceso. */
  dibujo: string;
  paso: Paso;
  estado: "normal" | "cambia" | "salta" | "nuevo";
  nota: string | null;
};

const ETIQUETA_ESTADO = { cambia: "Cambia", salta: "No se hace", nuevo: "Se agrega" } as const;

/** Arma la línea de pasos de la ruta aplicando los efectos del término elegido. */
function armarPasos(proceso: Proceso, pasosRuta: string[], termino: Termino | null): PasoVista[] {
  const out: PasoVista[] = [];
  pasosRuta.forEach((id) => {
    const efectos: Efecto[] = termino ? termino.efectos.filter((e) => e.paso === id) : [];
    const directo = efectos.find((e) => e.tipo !== "nuevo");
    out.push({
      clave: id,
      dibujo: id,
      paso: proceso.pasos[id],
      estado: directo ? directo.tipo : "normal",
      nota: directo ? directo.texto : null,
    });
    efectos.forEach((e) => {
      if (e.tipo === "nuevo") {
        out.push({
          clave: `${id}-nuevo`,
          dibujo: "alcohol",
          paso: { titulo: e.titulo, texto: e.texto },
          estado: "nuevo",
          nota: null,
        });
      }
    });
  });
  return out;
}

/** Grano de arroz que se achica con el pulido: lo gris es lo que se lima. */
function PulidoVisual() {
  const [queda, setQueda] = useState(60);
  const categoria =
    queda <= 50
      ? "Entra en daiginjo (50 % o menos)"
      : queda <= 60
        ? "Entra en ginjo (60 % o menos)"
        : queda <= 70
          ? "Entra en honjozo (70 % o menos)"
          : "Junmai no exige un mínimo de pulido";
  // El área del grano es proporcional a lo que queda.
  const escala = Math.sqrt(queda / 100);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="font-display text-xl font-medium text-ink">El pulido, a la vista</h3>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 120 150" className="h-32 w-24 shrink-0" role="img" aria-label={`Grano con el ${queda} % restante`}>
          <ellipse
            cx="60"
            cy="75"
            rx="44"
            ry="62"
            fill="none"
            stroke="var(--ink-300)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <ellipse
            cx="60"
            cy="75"
            rx={44 * escala}
            ry={62 * escala}
            fill="var(--ink-100)"
            stroke="var(--seal)"
            strokeWidth="2"
            style={{ transition: "rx 0.35s ease, ry 0.35s ease" }}
          />
          <ellipse cx="60" cy="75" rx="9" ry="13" fill="var(--ink-300)" opacity="0.7" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-display text-3xl font-medium text-ink">
            {queda} %
            <span className="ml-2 font-sans text-sm font-normal text-zinc-400">del grano queda</span>
          </p>
          <p className="mt-1 text-sm text-zinc-300">{categoria}</p>
          <p className="mt-1 text-xs leading-snug text-zinc-500">
            El centro es almidón; afuera hay proteínas y grasas. Más pulido: más finura y aroma, menos cuerpo.
          </p>
        </div>
      </div>
      <input
        type="range"
        min={35}
        max={90}
        step={5}
        value={queda}
        onChange={(e) => setQueda(Number(e.target.value))}
        aria-label="Porcentaje del grano que queda tras el pulido"
        className="mt-3 h-11 w-full accent-[var(--seal)]"
      />
      <div className="flex justify-between text-[0.65rem] uppercase tracking-wider text-zinc-500">
        <span>Más pulido</span>
        <span>Menos pulido</span>
      </div>
    </section>
  );
}

function BotonChip(props: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.activo}
      className={`min-h-10 rounded-full border px-3.5 text-left text-sm transition ${
        props.activo ? "border-seal bg-seal text-white" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {props.children}
    </button>
  );
}

export function Procesos() {
  const [procesoId, setProcesoId] = useState<Proceso["id"]>("sake");
  const [rutaId, setRutaId] = useState<string | null>(null);
  const [terminoId, setTerminoId] = useState<string | null>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  const proceso = PROCESOS.find((p) => p.id === procesoId) ?? PROCESOS[0];
  const ruta = proceso.rutas.find((r) => r.id === rutaId) ?? proceso.rutas[0];
  const variasRutas = proceso.rutas.length > 1;

  const grupos = useMemo(() => {
    const visibles = proceso.terminos.filter((t) => !variasRutas || t.grupo === ruta.label);
    const out: { grupo: string; terminos: Termino[] }[] = [];
    visibles.forEach((t) => {
      const g = out.find((x) => x.grupo === t.grupo);
      if (g) {
        g.terminos.push(t);
      } else {
        out.push({ grupo: t.grupo, terminos: [t] });
      }
    });
    return out;
  }, [proceso, ruta, variasRutas]);

  const termino = grupos.flatMap((g) => g.terminos).find((t) => t.id === terminoId) ?? null;
  const pasos = useMemo(() => armarPasos(proceso, ruta.pasos, termino), [proceso, ruta, termino]);

  const elegirTermino = (id: string) => {
    const nuevo = terminoId === id ? null : id;
    setTerminoId(nuevo);
    if (nuevo) {
      // Deja la explicación del término justo debajo de la barra, con los pasos a continuación.
      window.setTimeout(() => {
        tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {PROCESOS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === proceso.id}
            onClick={() => {
              setProcesoId(p.id);
              setRutaId(null);
              setTerminoId(null);
            }}
            className={`min-h-10 rounded-lg text-sm transition ${
              p.id === proceso.id ? "bg-ink text-paper" : "text-zinc-400 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-[0.95rem] leading-relaxed text-zinc-300">{proceso.intro}</p>

      {proceso.id === "sake" ? <PulidoVisual /> : null}

      {variasRutas ? (
        <section>
          <h3 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-zinc-500">Tipo</h3>
          <div className="flex flex-wrap gap-2">
            {proceso.rutas.map((r) => (
              <BotonChip
                key={r.id}
                activo={r.id === ruta.id}
                onClick={() => {
                  setRutaId(r.id);
                  setTerminoId(null);
                }}
              >
                {r.label}
              </BotonChip>
            ))}
          </div>
          <p className="mt-2 text-sm text-zinc-400">{ruta.resumen}</p>
        </section>
      ) : null}

      {/* Términos: barra fija para ir cambiando sin perder de vista la línea de pasos. */}
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+6.5rem)] z-20 -mx-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sm:top-[4.75rem] sm:mx-0">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-0">
          {grupos.map((g) => (
            <div key={g.grupo} className="flex shrink-0 items-center gap-2">
              {!variasRutas ? (
                <span className="pl-1 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {g.grupo}
                </span>
              ) : null}
              {g.terminos.map((t) => (
                <BotonChip key={t.id} activo={t.id === termino?.id} onClick={() => elegirTermino(t.id)}>
                  <span className="whitespace-nowrap">{t.label}</span>
                </BotonChip>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div ref={tarjeta} aria-live="polite" className="scroll-mt-44">
        {termino ? (
          <section key={termino.id} className="animate-fade-up rounded-xl border border-seal/40 bg-seal/10 p-4">
            <h3 className="font-display text-2xl font-medium text-ink">{termino.label}</h3>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-ink">{termino.resumen}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {termino.enCopa ? (
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-seal">En la copa</dt>
                  <dd className="text-zinc-300">{termino.enCopa}</dd>
                </div>
              ) : null}
              {termino.enCarta ? (
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-seal">En la carta</dt>
                  <dd className="text-zinc-300">{termino.enCarta}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500">
            Deslizá la barra de términos y tocá uno para ver qué paso cambia.
          </p>
        )}
      </div>

      <ol key={`${proceso.id}-${ruta.id}`} className="relative space-y-3 pl-10">
        {/* Línea del proceso con una gota que la recorre. */}
        <span aria-hidden className="absolute bottom-4 left-[0.95rem] top-4 w-px bg-zinc-700">
          <span className="guia-gota absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-seal motion-reduce:hidden" />
        </span>
        {pasos.map((p, i) => {
          const afectado = p.estado !== "normal";
          return (
            <li
              key={p.clave}
              data-afectado={afectado}
              className="animate-fade-up relative motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <span
                aria-hidden
                className={`absolute -left-10 top-3 flex size-8 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-300 ${
                  afectado
                    ? p.estado === "salta"
                      ? "border-zinc-600 bg-zinc-950 text-zinc-500"
                      : "border-seal bg-seal text-white"
                    : "border-zinc-700 bg-zinc-950 text-zinc-400"
                }`}
              >
                {afectado && p.estado !== "salta" ? (
                  <span className="absolute inset-0 animate-ping rounded-full border border-seal motion-reduce:hidden" />
                ) : null}
                {p.estado === "nuevo" ? "+" : p.estado === "salta" ? "✕" : i + 1}
              </span>
              <div
                className={`rounded-xl border px-4 py-3 transition-colors duration-300 ${
                  p.estado === "salta"
                    ? "border-dashed border-zinc-700 bg-transparent"
                    : afectado
                      ? "border-seal/60 bg-seal/10"
                      : termino
                        ? "border-zinc-800 bg-zinc-900/30 opacity-60"
                        : "border-zinc-800 bg-zinc-900/60"
                }`}
              >
                <div className="mb-3 sm:float-right sm:mb-2 sm:ml-4 sm:w-56">
                  <IlustracionPaso
                    proceso={proceso.id}
                    paso={p.dibujo}
                    titulo={p.paso.titulo}
                    termino={p.estado === "cambia" ? termino?.id : undefined}
                    apagada={p.estado === "salta"}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4
                    className={`font-display text-lg font-medium leading-tight ${
                      p.estado === "salta" ? "text-zinc-500 line-through" : "text-ink"
                    }`}
                  >
                    {p.paso.titulo}
                  </h4>
                  {afectado ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${
                        p.estado === "salta" ? "border border-zinc-600 text-zinc-400" : "bg-seal text-white"
                      }`}
                    >
                      {ETIQUETA_ESTADO[p.estado as keyof typeof ETIQUETA_ESTADO]}
                    </span>
                  ) : null}
                </div>
                {p.nota ? (
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink">{p.nota}</p>
                ) : null}
                <p
                  className={`mt-1 text-sm leading-relaxed ${
                    p.nota ? "text-zinc-500" : "text-zinc-400"
                  } ${p.estado === "salta" ? "line-through decoration-zinc-600" : ""}`}
                >
                  {p.paso.texto}
                </p>
                <div className="clear-both" />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
