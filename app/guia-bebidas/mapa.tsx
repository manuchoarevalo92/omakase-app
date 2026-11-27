"use client";

import { ChevronRight, MapPin, Search, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { vibrar } from "@/app/ui";
import { normalizarBusqueda, type GuiaBebida } from "@/src/lib/guia-bebidas";

import {
  HELADERAS,
  LABEL_TIPO,
  esFichaDe,
  indiceReferencias,
  type Carril,
  type Estante,
  type Heladera,
  type ItemCarril,
  type TipoBotella,
  type Ubicacion,
} from "./mapa-data";

/** Un color de cinta por categoría; tonos medios que se leen de día y de noche. */
const COLOR: Record<TipoBotella, string> = {
  champ: "#b8891a",
  blanco: "#4a8a57",
  tinto: "#a33352",
  sake: "#4d5ec2",
  otro: "#77818c",
};
const FRIO = "#2f86a0";

type Seleccion = {
  letra: string;
  zona: number;
  estante: number;
  carril: number;
};

function Cinta(props: { tipo: TipoBotella }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[3px]"
      style={{ background: COLOR[props.tipo] }}
    />
  );
}

function Temp(props: { temp: number }) {
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.78rem] font-semibold"
      style={{ color: FRIO, background: `${FRIO}1f` }}
    >
      {props.temp} °C
    </span>
  );
}

// --- Dibujo -----------------------------------------------------------------

const ANCHO = 360;
const X0 = 50;
const X1 = 348;
const FILA = 70;
const FILA_TEXTO = 40;
const BANDA = 24;

/** Parte una etiqueta en hasta dos renglones según el ancho del carril. */
function renglones(texto: string, ancho: number): string[] {
  const max = Math.max(4, Math.floor(ancho / 5.2));
  if (texto.length <= max) return [texto];
  const palabras = texto.split(" ");
  let mejor: [string, string] | null = null;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ");
    const b = palabras.slice(i).join(" ");
    if (
      !mejor ||
      Math.max(a.length, b.length) <
        Math.max(mejor[0].length, mejor[1].length)
    ) {
      mejor = [a, b];
    }
  }
  if (!mejor) return [`${texto.slice(0, max - 1)}…`];
  return mejor.map((r) => (r.length > max ? `${r.slice(0, max - 1)}…` : r));
}

function etiquetaCarril(c: Carril): string {
  const unico = c.items.length === 1 ? c.items[0] : null;
  return unico?.n && unico.n > 1 ? `${c.corto} ×${unico.n}` : c.corto;
}

const botellasDe = (c: Carril) =>
  c.items.reduce((total, i) => total + (i.n ?? 1), 0);

function Botella(props: {
  cx: number;
  cy: number;
  r: number;
  tipo: TipoBotella;
  dePie?: boolean;
  marcada: boolean;
}) {
  const { cx, cy, r, tipo, dePie, marcada } = props;
  const color = COLOR[tipo];
  if (dePie) {
    const ancho = Math.min(14, r * 2 - 2);
    return (
      <g>
        <rect
          x={cx - 2.5}
          y={cy - 16}
          width={5}
          height={9}
          rx={1.5}
          fill={color}
        />
        <rect
          x={cx - ancho / 2}
          y={cy - 9}
          width={ancho}
          height={23}
          rx={3}
          fill={color}
          stroke={marcada ? "currentColor" : "none"}
          strokeWidth={2}
          className={marcada ? "text-accent" : undefined}
        />
      </g>
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      stroke={marcada ? "currentColor" : "none"}
      strokeWidth={2.5}
      className={marcada ? "text-accent" : undefined}
    />
  );
}

function FilaEstante(props: {
  estante: Estante;
  y: number;
  activo: (carril: number) => boolean;
  atenuado: (carril: number) => boolean;
  onTocar: (carril: number) => void;
}) {
  const { estante, y, activo, atenuado, onTocar } = props;
  const cap = Math.max(estante.capacidad, 1);
  const w = (X1 - X0) / cap;
  const r = Math.min(14, w / 2 - 3);
  const cy = y + 24;
  const inicios = estante.carriles.map((_, ci) =>
    estante.carriles.slice(0, ci).reduce((t, c) => t + botellasDe(c), 0),
  );
  const ocupadas = estante.carriles.reduce((t, c) => t + botellasDe(c), 0);

  return (
    <g>
      <text
        x={12}
        y={estante.nivel ? y + 24 : y + 29}
        className="fill-current font-mono"
        fontSize={12.5}
        fontWeight={600}
      >
        {estante.codigo}
      </text>
      {estante.nivel ? (
        <text x={12} y={y + 37} fontSize={9} className="fill-label-3">
          {estante.nivel}
        </text>
      ) : null}

      {estante.texto ? (
        <text
          x={(X0 + X1) / 2}
          y={y + 25}
          textAnchor="middle"
          fontSize={10.5}
          className="fill-label-2"
        >
          {estante.texto}
        </text>
      ) : null}

      {estante.carriles.map((c, ci) => {
        const desde = inicios[ci];
        const total = botellasDe(c);
        const xa = X0 + w * desde + 4;
        const xb = X0 + w * (desde + total) - 4;
        const marcado = activo(ci);
        const lineas = renglones(etiquetaCarril(c), xb - xa + 14);
        return (
          <g
            key={ci}
            role="button"
            tabIndex={0}
            aria-label={`${estante.codigo}: ${c.items.map((i) => i.nombre).join(", ")}`}
            aria-pressed={marcado}
            onClick={() => onTocar(ci)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTocar(ci);
              }
            }}
            className="cursor-pointer outline-none transition-opacity duration-200 [-webkit-tap-highlight-color:transparent]"
            opacity={atenuado(ci) ? 0.22 : 1}
          >
            <rect
              x={xa - 4}
              y={y}
              width={xb - xa + 8}
              height={FILA}
              fill="transparent"
            />
            {marcado ? (
              <rect
                x={xa - 3}
                y={y + 3}
                width={xb - xa + 6}
                height={FILA - 6}
                rx={8}
                className="fill-accent-soft"
              />
            ) : null}
            {Array.from({ length: total }, (_, k) => (
              <Botella
                key={k}
                cx={X0 + w * (desde + k + 0.5)}
                cy={cy}
                r={r}
                tipo={c.tipo}
                dePie={estante.dePie}
                marcada={marcado}
              />
            ))}
            <line
              x1={xa}
              x2={xb}
              y1={y + 44}
              y2={y + 44}
              stroke="currentColor"
              strokeOpacity={marcado ? 1 : 0.5}
              strokeWidth={marcado ? 2.5 : 1.5}
              strokeLinecap="round"
              className={marcado ? "text-accent" : undefined}
            />
            {lineas.map((l, li) => (
              <text
                key={li}
                x={(xa + xb) / 2}
                y={y + 56 + li * 11}
                textAnchor="middle"
                fontSize={10}
                fontWeight={marcado ? 600 : 400}
                className="fill-current"
              >
                {l}
              </text>
            ))}
          </g>
        );
      })}

      {Array.from({ length: Math.max(0, estante.capacidad - ocupadas) }, (_, k) =>
        estante.dePie ? null : (
          <circle
            key={`libre-${k}`}
            cx={X0 + w * (ocupadas + k + 0.5)}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeDasharray="3 3"
          />
        ),
      )}
    </g>
  );
}

function DibujoHeladera(props: {
  heladera: Heladera;
  seleccion: Seleccion | null;
  coincide: ((c: Carril) => boolean) | null;
  onTocar: (zona: number, estante: number, carril: number) => void;
}) {
  const { heladera, seleccion, coincide, onTocar } = props;
  const partes: React.ReactNode[] = [];
  let y = 4;

  heladera.zonas.forEach((zona, zi) => {
    partes.push(
      <g key={`z${zi}`}>
        <rect x={3} y={y} width={ANCHO - 6} height={BANDA} className="fill-fill" />
        <text x={14} y={y + 16} fontSize={11} fontWeight={600} className="fill-current">
          {zona.titulo}
        </text>
        <text
          x={ANCHO - 14}
          y={y + 16}
          textAnchor="end"
          fontSize={11}
          fontWeight={600}
          fill={FRIO}
          className="font-mono"
        >
          {zona.temp} °C
        </text>
      </g>,
    );
    y += BANDA + 2;
    zona.estantes.forEach((estante, ei) => {
      const alto = estante.texto ? FILA_TEXTO : FILA;
      const esEste = (ci: number) =>
        seleccion?.letra === heladera.letra &&
        seleccion.zona === zi &&
        seleccion.estante === ei &&
        seleccion.carril === ci;
      partes.push(
        <Fragment key={`e${zi}-${ei}`}>
          <FilaEstante
            estante={estante}
            y={y}
            activo={(ci) =>
              esEste(ci) ||
              Boolean(coincide && coincide(estante.carriles[ci]))
            }
            atenuado={(ci) =>
              Boolean(coincide) && !coincide!(estante.carriles[ci]) && !esEste(ci)
            }
            onTocar={(ci) => onTocar(zi, ei, ci)}
          />
          <line
            x1={10}
            x2={ANCHO - 10}
            y1={y + alto}
            y2={y + alto}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1.5}
          />
        </Fragment>,
      );
      y += alto + 2;
    });
  });

  const alto = y + 4;
  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${alto}`}
      role="group"
      aria-label={`Heladera ${heladera.letra}, ${heladera.nombre}: cada figura es una botella`}
      className="block h-auto w-full max-w-[26rem] text-label [font-family:inherit]"
    >
      {partes}
      <rect
        x={2}
        y={2}
        width={ANCHO - 4}
        height={alto - 4}
        rx={10}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  );
}

// --- Fichas -----------------------------------------------------------------

function useFichas(bebidas: GuiaBebida[]) {
  const porClave = useMemo(() => {
    const mapa = new Map<string, GuiaBebida>();
    indiceReferencias().forEach((r) => {
      const b = bebidas.find((x) => esFichaDe(r.ficha, r.tipo, x));
      if (b && r.ficha) mapa.set(`${r.tipo}:${r.ficha}`, b);
    });
    return mapa;
  }, [bebidas]);
  return (ficha: string | undefined, tipo: TipoBotella) =>
    ficha ? (porClave.get(`${tipo}:${ficha}`) ?? null) : null;
}

function BotonFicha(props: { bebida: GuiaBebida; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onAbrir}
      className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-full bg-fill px-3 text-[0.82rem] font-medium text-label transition active:scale-95"
    >
      Ficha
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function Elegido(props: {
  heladera: Heladera;
  seleccion: Seleccion;
  fichaDe: ReturnType<typeof useFichas>;
  onAbrir: (b: GuiaBebida) => void;
  onCerrar: () => void;
}) {
  const { heladera, seleccion, fichaDe, onAbrir, onCerrar } = props;
  const zona = heladera.zonas[seleccion.zona];
  const estante = zona?.estantes[seleccion.estante];
  const carril = estante?.carriles[seleccion.carril];
  if (!zona || !estante || !carril) return null;
  return (
    <div className="animate-fade-up mt-3 rounded-xl border border-separator bg-surface px-3 py-2.5 motion-reduce:animate-none">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[0.8rem] text-label-3">
          <span className="font-mono font-semibold text-label">
            {estante.codigo}
          </span>
          {estante.nivel ? ` ${estante.nivel}` : ""} · {estante.familia}
        </p>
        <Temp temp={zona.temp} />
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-label-3"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="mt-1 divide-y divide-separator">
        {carril.items.map((item) => {
          const ficha = fichaDe(item.ficha, carril.tipo);
          return (
            <li key={item.nombre} className="flex items-center gap-2.5 py-2">
              <Cinta tipo={carril.tipo} />
              <p className="min-w-0 flex-1 text-[0.97rem] leading-snug text-label">
                {item.nombre}
                {item.n ? (
                  <span className="text-label-3"> · {item.n} en frío</span>
                ) : null}
              </p>
              {ficha ? (
                <BotonFicha bebida={ficha} onAbrir={() => onAbrir(ficha)} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ListaEstantes(props: {
  heladera: Heladera;
  fichaDe: ReturnType<typeof useFichas>;
  onAbrir: (b: GuiaBebida) => void;
}) {
  const { heladera, fichaDe, onAbrir } = props;
  const chip = (item: ItemCarril, tipo: TipoBotella) => {
    const ficha = fichaDe(item.ficha, tipo);
    const contenido = (
      <>
        <Cinta tipo={tipo} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{item.nombre}</span>
        {item.n ? (
          <b className="font-mono font-semibold">{item.n}</b>
        ) : null}
      </>
    );
    const clase =
      "inline-flex min-h-8 items-center gap-1.5 rounded-md bg-fill px-2 py-1 text-left text-[0.86rem] text-label";
    return ficha ? (
      <button
        key={item.nombre}
        type="button"
        onClick={() => onAbrir(ficha)}
        className={`${clase} transition active:scale-95`}
      >
        {contenido}
      </button>
    ) : (
      <span key={item.nombre} className={clase}>
        {contenido}
      </span>
    );
  };

  return (
    <details className="group mt-3">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-[0.88rem] font-medium text-label-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 transition-transform group-open:rotate-90"
          aria-hidden
        />
        Estante por estante
      </summary>
      <div className="space-y-4 pt-1">
        {heladera.zonas.map((zona) => (
          <div key={zona.titulo}>
            <div className="flex flex-wrap items-center gap-2 border-b-2 border-label pb-1.5">
              <strong className="font-display text-[0.95rem] font-medium text-ink">
                {zona.titulo}
              </strong>
              <Temp temp={zona.temp} />
            </div>
            <ul className="divide-y divide-separator">
              {zona.estantes.map((e, ei) => {
                const llenas = e.carriles.reduce(
                  (t, c) => t + botellasDe(c),
                  0,
                );
                return (
                  <li
                    key={ei}
                    className="grid grid-cols-[2.6rem_minmax(0,1fr)_auto] gap-2 py-2.5"
                  >
                    <span className="font-mono text-[0.95rem] font-semibold text-label">
                      {e.codigo}
                    </span>
                    <div className="min-w-0">
                      <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-label-3">
                        {e.nivel ? `${e.nivel} · ` : ""}
                        {e.familia}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {e.carriles.flatMap((c) =>
                          c.items.map((item) => chip(item, c.tipo)),
                        )}
                        {e.detalle?.map((item) => chip(item, "otro"))}
                        {e.texto && !e.detalle ? (
                          <p className="text-[0.86rem] text-label-2">
                            {e.texto}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {e.capacidad > 0 && !e.dePie ? (
                      <span className="pt-0.5 font-mono text-[0.75rem] text-label-3">
                        {llenas}/{e.capacidad}
                      </span>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

// --- Pantalla ---------------------------------------------------------------

const idHeladera = (letra: string) => `heladera-${letra}`;

function irA(letra: string) {
  document
    .getElementById(idHeladera(letra))
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Mapa(props: {
  bebidas: GuiaBebida[];
  onAbrir: (bebida: GuiaBebida) => void;
}) {
  const { bebidas, onAbrir } = props;
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const fichaDe = useFichas(bebidas);
  const referencias = useMemo(() => indiceReferencias(), []);

  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
  const coincideTexto = (texto: string) => {
    const t = normalizarBusqueda(texto);
    return palabras.every((p) => t.includes(p));
  };
  const coincide =
    palabras.length > 0
      ? (c: Carril) =>
          c.items.some((i) => coincideTexto(`${i.nombre} ${c.corto}`))
      : null;
  const resultados =
    palabras.length > 0
      ? referencias.filter((r) => coincideTexto(r.nombre))
      : [];

  const elegir = (sel: Seleccion) => {
    vibrar();
    setSeleccion((actual) =>
      actual &&
      actual.letra === sel.letra &&
      actual.zona === sel.zona &&
      actual.estante === sel.estante &&
      actual.carril === sel.carril
        ? null
        : sel,
    );
  };

  const verUbicacion = (u: Ubicacion) => {
    if (u.carril !== undefined) {
      setSeleccion({
        letra: u.letra,
        zona: u.zona,
        estante: u.estante,
        carril: u.carril,
      });
    }
    irA(u.letra);
  };

  const porLugar = (["Barra", "Almacén"] as const).map((lugar) => ({
    lugar,
    heladeras: HELADERAS.filter((h) => h.lugar === lugar),
  }));

  return (
    <div className="space-y-5">
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 -mx-4 space-y-2.5 bg-surface/90 px-4 pb-2 pt-2 backdrop-blur-xl sm:top-0 sm:mx-0 sm:px-0">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-3"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="¿Dónde está…? Krug, Ekam, Kido…"
            aria-label="Buscar una botella en el mapa"
            className="min-h-12 w-full rounded-control bg-fill pl-10 pr-12 text-[1rem] text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {busqueda ? (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Borrar búsqueda"
              className="absolute right-0 top-0 inline-flex size-12 items-center justify-center text-label-3"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <nav
          aria-label="Ir a una heladera"
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
        >
          {porLugar.map(({ lugar, heladeras }) => (
            <div key={lugar} className="flex items-center gap-1.5">
              <span className="text-[0.75rem] text-label-3">{lugar}</span>
              {heladeras.map((h) => (
                <button
                  key={h.letra}
                  type="button"
                  onClick={() => irA(h.letra)}
                  aria-label={`Ir a la heladera ${h.letra}, ${h.nombre}`}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-fill font-mono text-[0.95rem] font-semibold text-label transition active:scale-95"
                >
                  {h.letra}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {palabras.length > 0 ? (
        resultados.length === 0 ? (
          <p className="rounded-card bg-surface-3 px-4 py-4 text-[0.92rem] leading-relaxed text-label-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            No está en ninguna heladera. Lo que no entra en frío queda en la
            reserva del almacén, a temperatura ambiente.
          </p>
        ) : (
          <ul
            aria-label="Dónde está"
            className="divide-y divide-separator rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
          >
            {resultados.map((r) => {
              const ficha = fichaDe(r.ficha, r.tipo);
              return (
                <li key={r.nombre} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-1.5">
                    <Cinta tipo={r.tipo} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.98rem] leading-snug text-label">
                      {r.nombre}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.ubicaciones.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => verUbicacion(u)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-[0.82rem] text-accent transition active:scale-95"
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          <span className="font-mono font-semibold">
                            {u.codigo}
                          </span>
                          <span>
                            {u.nivel ? `${u.nivel} · ` : ""}
                            {u.lugar}
                            {u.n ? ` · ${u.n}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {ficha ? (
                    <BotonFicha bebida={ficha} onAbrir={() => onAbrir(ficha)} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.85rem] text-label-2">
          {(Object.keys(LABEL_TIPO) as TipoBotella[])
            .filter((t) => t !== "otro")
            .map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Cinta tipo={t} />
                {LABEL_TIPO[t]}
              </span>
            ))}
          <span className="text-label-3">
            Tocá una botella para ver qué es.
          </span>
        </div>
      )}

      {porLugar.map(({ lugar, heladeras }) => (
        <section key={lugar} className="space-y-4">
          <h2 className="flex items-center gap-3 font-display text-xl font-medium text-ink">
            {lugar}
            <span className="h-px flex-1 bg-fill-strong" />
          </h2>
          {heladeras.map((h) => (
            <article
              key={h.letra}
              id={idHeladera(h.letra)}
              className="scroll-mt-44 rounded-card bg-surface-3 px-3.5 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-5"
            >
              <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[1.7rem] font-semibold leading-none text-ink">
                  {h.letra}
                </span>
                <h3 className="font-display text-[1.2rem] font-medium text-ink">
                  {h.nombre}
                </h3>
                <span className="text-[0.88rem] text-label-3">{h.lugar}</span>
              </header>
              {h.nota ? (
                <p className="mb-3 text-[0.88rem] leading-snug text-label-2">
                  {h.nota}
                </p>
              ) : null}
              <DibujoHeladera
                heladera={h}
                seleccion={seleccion}
                coincide={coincide}
                onTocar={(zona, estante, carril) =>
                  elegir({ letra: h.letra, zona, estante, carril })
                }
              />
              {seleccion?.letra === h.letra ? (
                <Elegido
                  heladera={h}
                  seleccion={seleccion}
                  fichaDe={fichaDe}
                  onAbrir={onAbrir}
                  onCerrar={() => setSeleccion(null)}
                />
              ) : null}
              <ListaEstantes heladera={h} fichaDe={fichaDe} onAbrir={onAbrir} />
            </article>
          ))}
        </section>
      ))}

      <section className="rounded-card bg-surface-3 px-4 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <h3 className="font-display text-xl font-medium text-ink">
          Cómo se ordena
        </h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-snug text-label-2 marker:text-label-3">
          <li>
            Un estante, una familia. La etiqueta del estante lleva el código y
            el nombre de la familia.
          </li>
          <li>
            Un carril, una referencia: las botellas iguales van una detrás de
            otra. El número es cuántas van en frío en ese estante.
          </li>
          <li>
            Champagne en E, blancos en A, tintos en B, copas en C, sake en D.
            Al cierre se repone cada carril desde la reserva hasta su número.
          </li>
        </ol>
        <p className="mt-3 text-sm leading-snug text-label-3">
          Lo que no entra en frío queda en la reserva del almacén, a
          temperatura ambiente.
        </p>
      </section>
    </div>
  );
}
