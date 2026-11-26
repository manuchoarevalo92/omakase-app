"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  CATEGORIAS_GUIA,
  labelCategoria,
  type CategoriaGuia,
  type GuiaBebida,
  type GuiaCompleta,
} from "@/src/lib/guia-bebidas";

import { FotoBotella, Md } from "./ui";

type Mazo = "reconocer" | "presentar" | "glosario" | "preguntas";

const MAZOS: { id: Mazo; titulo: string; detalle: string }[] = [
  { id: "reconocer", titulo: "Reconocer la botella", detalle: "Ves la foto, decís qué es" },
  { id: "presentar", titulo: "Presentar la botella", detalle: "Ves el nombre, la contás como en sala" },
  { id: "glosario", titulo: "Glosario", detalle: "Término → qué significa" },
  { id: "preguntas", titulo: "Preguntas de repaso", detalle: "Para responder en voz alta" },
];

type Tarjeta =
  | { id: string; tipo: "bebida"; conFoto: boolean; bebida: GuiaBebida }
  | { id: string; tipo: "glosario"; area: string; termino: string; definicion: string }
  | { id: string; tipo: "pregunta"; area: string; pregunta: string };

function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function armarMazo(guia: GuiaCompleta, mazo: Mazo, categoria: CategoriaGuia | "todas"): Tarjeta[] {
  if (mazo === "glosario") {
    return guia.glosario.map((g) => ({ tipo: "glosario", ...g }));
  }
  if (mazo === "preguntas") {
    return guia.preguntas.map((p) => ({ tipo: "pregunta", ...p }));
  }
  return guia.bebidas
    .filter((b) => b.activa && (categoria === "todas" || b.categoria === categoria))
    .filter((b) => (mazo === "reconocer" ? Boolean(b.fotoUrl) : true))
    .map((b) => ({ id: b.id, tipo: "bebida", conFoto: mazo === "reconocer", bebida: b }));
}

function Frente(props: { tarjeta: Tarjeta }) {
  const { tarjeta } = props;
  if (tarjeta.tipo === "bebida") {
    return tarjeta.conFoto ? (
      <div className="flex flex-col items-center gap-4">
        <FotoBotella
          fotoUrl={tarjeta.bebida.fotoUrl}
          nombre="la tarjeta"
          categoria={tarjeta.bebida.categoria}
          className="h-72 w-full max-w-[16rem] rounded-xl"
        />
        <p className="text-sm text-zinc-400">¿Qué botella es y de dónde viene?</p>
      </div>
    ) : (
      <div className="space-y-3 text-center">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-zinc-500">
          {labelCategoria(tarjeta.bebida.categoria)}
        </p>
        <p className="font-display text-3xl font-medium leading-tight text-ink">{tarjeta.bebida.nombre}</p>
        <p className="text-sm text-zinc-400">¿Quién la hace, cómo es y cómo la presentás?</p>
      </div>
    );
  }
  if (tarjeta.tipo === "glosario") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-zinc-500">{tarjeta.area}</p>
        <p className="font-display text-3xl font-medium leading-tight text-ink">{tarjeta.termino}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-zinc-500">{tarjeta.area}</p>
      <p className="font-display text-2xl font-medium leading-snug text-ink">
        <Md texto={tarjeta.pregunta} />
      </p>
    </div>
  );
}

function Dorso(props: { tarjeta: Tarjeta }) {
  const { tarjeta } = props;
  if (tarjeta.tipo === "bebida") {
    const b = tarjeta.bebida;
    return (
      <div className="space-y-3 text-left">
        <div className="flex items-start gap-3">
          <FotoBotella
            fotoUrl={b.fotoUrl}
            nombre={b.nombre}
            categoria={b.categoria}
            className="h-24 w-16 shrink-0 rounded-lg"
            iconoClassName="h-6 w-6"
          />
          <div className="min-w-0 space-y-1">
            <p className="font-display text-xl font-medium leading-tight text-ink">{b.nombre}</p>
            {b.precio ? <p className="font-mono text-xs text-seal">{b.precio}</p> : null}
            {b.meta ? <p className="text-sm text-zinc-400">{b.meta}</p> : null}
          </div>
        </div>
        {b.enSala ? (
          <p className="rounded-lg border border-seal/40 bg-seal/10 px-3 py-2 text-sm leading-relaxed text-ink">
            <span className="font-semibold text-seal">En sala: </span>
            <Md texto={b.enSala} />
          </p>
        ) : null}
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-300 marker:text-seal">
          {b.datos.map((d, i) => (
            <li key={i}>
              <Md texto={d} />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (tarjeta.tipo === "glosario") {
    return (
      <div className="space-y-2 text-center">
        <p className="font-display text-xl text-ink">{tarjeta.termino}</p>
        <p className="text-base leading-relaxed text-zinc-300">
          <Md texto={tarjeta.definicion} />
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-sm leading-relaxed text-zinc-400">
      Esta pregunta no tiene una única respuesta escrita: respondela en voz alta y, si dudaste,
      buscá la ficha en Machete o el tema en Estudiar.
    </p>
  );
}

export function Repaso(props: { guia: GuiaCompleta }) {
  const { guia } = props;
  const [mazo, setMazo] = useState<Mazo | null>(null);
  const [categoria, setCategoria] = useState<CategoriaGuia | "todas">("todas");
  const [cola, setCola] = useState<Tarjeta[]>([]);
  const [total, setTotal] = useState(0);
  const [sabidas, setSabidas] = useState(0);
  const [falladas, setFalladas] = useState<Tarjeta[]>([]);
  const [volteada, setVolteada] = useState(false);

  const cantidades = useMemo(() => {
    const out = {} as Record<Mazo, number>;
    MAZOS.forEach((m) => {
      out[m.id] = armarMazo(guia, m.id, categoria).length;
    });
    return out;
  }, [guia, categoria]);

  const empezar = (id: Mazo, tarjetas: Tarjeta[]) => {
    setMazo(id);
    setCola(mezclar(tarjetas));
    setTotal(tarjetas.length);
    setSabidas(0);
    setFalladas([]);
    setVolteada(false);
  };

  const responder = (sabia: boolean) => {
    const [actual, ...resto] = cola;
    if (sabia) {
      setSabidas((n) => n + 1);
    } else {
      setFalladas((f) => [...f, actual]);
    }
    setCola(resto);
    setVolteada(false);
  };

  if (mazo === null) {
    return (
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500">Botellas de</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: "todas" as const, label: "Toda la carta" }, ...CATEGORIAS_GUIA].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                aria-pressed={categoria === c.id}
                className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm transition ${
                  categoria === c.id
                    ? "border-seal/60 bg-seal/15 text-ink"
                    : "border-zinc-800 text-zinc-400 hover:text-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MAZOS.map((m) => {
            const n = cantidades[m.id];
            return (
              <button
                key={m.id}
                type="button"
                disabled={n === 0}
                onClick={() => empezar(m.id, armarMazo(guia, m.id, categoria))}
                className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-zinc-600 disabled:opacity-40"
              >
                <span className="font-display text-xl font-medium text-ink">{m.titulo}</span>
                <span className="mt-1 text-sm text-zinc-400">{m.detalle}</span>
                <span className="mt-3 font-mono text-xs text-zinc-500">
                  {n === 0 ? "Sin tarjetas todavía" : `${n} tarjetas`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const actual = cola[0];

  if (!actual) {
    return (
      <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <p className="font-display text-3xl font-medium text-ink">
          {sabidas} de {total}
        </p>
        <p className="text-sm text-zinc-400">
          {falladas.length === 0
            ? "Las sabías todas."
            : `Te quedaron ${falladas.length} para repasar.`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {falladas.length > 0 ? (
            <button
              type="button"
              onClick={() => empezar(mazo, falladas)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-seal px-5 text-sm font-medium text-white"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Repasar las falladas
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMazo(null)}
            className="min-h-11 rounded-lg border border-zinc-700 px-5 text-sm text-zinc-300"
          >
            Elegir otro mazo
          </button>
        </div>
      </div>
    );
  }

  const hechas = total - cola.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMazo(null)}
          className="min-h-10 shrink-0 text-sm text-zinc-400 underline-offset-4 hover:text-ink hover:underline"
        >
          Salir
        </button>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={hechas}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div className="h-full bg-seal transition-all" style={{ width: `${(hechas / total) * 100}%` }} />
        </div>
        <p className="shrink-0 font-mono text-xs text-zinc-500">
          {hechas + 1}/{total}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setVolteada(true)}
        disabled={volteada}
        className="flex min-h-[24rem] w-full flex-col items-stretch justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 disabled:cursor-default"
      >
        {volteada ? <Dorso tarjeta={actual} /> : <Frente tarjeta={actual} />}
        {!volteada ? (
          <span className="mt-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
            Tocá para ver la respuesta
          </span>
        ) : null}
      </button>

      {volteada ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => responder(false)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 text-sm text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden />
            No la sabía
          </button>
          <button
            type="button"
            onClick={() => responder(true)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-ok text-sm font-medium text-white"
          >
            <Check className="h-4 w-4" aria-hidden />
            La sabía
          </button>
        </div>
      ) : null}
    </div>
  );
}
