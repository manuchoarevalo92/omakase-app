"use client";

import { CircleAlert, MessageCircle } from "lucide-react";
import { useState } from "react";

import { DibujoServicio } from "./ilustraciones-servicio";
import { ERRORES_COMUNES, PROTOCOLOS, type Protocolo } from "./servicio-data";

type Vista = Protocolo["id"] | "frases";

function Frase(props: { texto: string }) {
  return (
    <p className="mt-2 flex gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[0.92rem] leading-snug text-label">
      <MessageCircle
        className="mt-0.5 h-4 w-4 shrink-0 text-accent"
        aria-hidden
      />
      <span>
        <span className="sr-only">Decí: </span>«{props.texto}»
      </span>
    </p>
  );
}

function Ojo(props: { texto: string }) {
  return (
    <p className="mt-2 flex gap-2 text-[0.88rem] leading-snug text-label-2">
      <CircleAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-hidden
      />
      <span>
        <strong className="font-semibold text-label">Ojo:</strong> {props.texto}
      </span>
    </p>
  );
}

function Pasos(props: { protocolo: Protocolo }) {
  const { protocolo } = props;
  return (
    <ol key={protocolo.id} className="relative space-y-3 pl-10">
      <span
        aria-hidden
        className="absolute bottom-4 left-[0.95rem] top-4 w-px bg-fill-strong"
      />
      {protocolo.pasos.map((paso, i) => (
        <li
          key={paso.id}
          className="animate-fade-up relative motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
        >
          <span
            aria-hidden
            className="absolute -left-10 top-3 flex size-8 items-center justify-center rounded-full border border-separator bg-surface font-mono text-xs text-label-2"
          >
            {i + 1}
          </span>
          <div className="rounded-xl border border-separator bg-surface-3 px-4 py-3">
            <div className="mb-3 sm:float-right sm:mb-2 sm:ml-4 sm:w-56">
              <DibujoServicio id={paso.id} titulo={paso.titulo} />
            </div>
            <h4 className="font-display text-lg font-medium leading-tight text-ink">
              {paso.titulo}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-label-2">
              {paso.texto}
            </p>
            {paso.frase ? <Frase texto={paso.frase} /> : null}
            {paso.ojo ? <Ojo texto={paso.ojo} /> : null}
            <div className="clear-both" />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Todas las frases para decirle al comensal, juntas: sirve de machete. */
function Frases() {
  return (
    <div className="space-y-5">
      <p className="text-[0.95rem] leading-relaxed text-label-2">
        Lo que se le dice al comensal en cada momento. No hace falta decirlo
        palabra por palabra: es para tener a mano cómo arrancar.
      </p>
      {PROTOCOLOS.map((p) => {
        const conFrase = p.pasos.filter((paso) => paso.frase);
        if (conFrase.length === 0) {
          return null;
        }
        return (
          <section key={p.id}>
            <h3 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-label-3">
              {p.label}
            </h3>
            <ul className="divide-y divide-separator rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              {conFrase.map((paso) => (
                <li key={paso.id} className="px-4 py-3">
                  <p className="text-[0.8rem] text-label-3">{paso.titulo}</p>
                  <p className="mt-0.5 text-[0.97rem] leading-snug text-label">
                    «{paso.frase}»
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function Servicio() {
  const [vista, setVista] = useState<Vista>("basico");
  const protocolo = PROTOCOLOS.find((p) => p.id === vista) ?? null;

  return (
    <div className="space-y-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {[
          ...PROTOCOLOS.map((p) => ({ id: p.id as Vista, label: p.label })),
          { id: "frases" as Vista, label: "Frases" },
        ].map((op) => (
          <button
            key={op.id}
            type="button"
            aria-pressed={vista === op.id}
            onClick={() => setVista(op.id)}
            className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm transition ${
              vista === op.id
                ? "border-seal bg-seal text-[#fff]"
                : "border-separator text-label-2 hover:border-fill-strong"
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>

      {protocolo ? (
        <>
          <p className="text-[0.95rem] leading-relaxed text-label-2">
            {protocolo.intro}
          </p>
          <Pasos protocolo={protocolo} />
          {protocolo.id === "basico" ? (
            <section className="rounded-card bg-surface-3 px-4 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <h3 className="font-display text-xl font-medium text-ink">
                Errores de principiante
              </h3>
              <ul className="mt-2 space-y-1.5">
                {ERRORES_COMUNES.map((e) => (
                  <li
                    key={e}
                    className="flex gap-2 text-sm leading-snug text-label-2"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-danger"
                    />
                    {e}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <Frases />
      )}
    </div>
  );
}
