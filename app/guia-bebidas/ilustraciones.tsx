"use client";

import type { ReactNode } from "react";

/**
 * Ilustraciones de los pasos de Elaboración: escenas chicas en SVG (200×110) con
 * personitas trabajando. Colores fijos sobre un fondo de papel claro, así se ven
 * igual en tema día y noche. Las animaciones (.guia-*) viven en globals.css.
 */

const TINTA = "#3d3a36";
const LINEA = "#8a847a";
const SUAVE = "#e4dfd4";
const FONDO = "#f7f3ea";
const PIEL = "#f0c9a0";
const PELO = "#3b2f2a";
const ROJO = "#c43a2e";
const MADERA = "#c39a6b";
const MADERA_OSC = "#8a6238";
const ACERO = "#cfd3d6";
const COBRE = "#c77b4a";
const SAKE = "#ece4c0";
const BLANCO = "#e3d77c";
const TINTO = "#8c2f45";
const WHISKY = "#d39a3c";
const AGUA = "#7fb6de";
const ARROZ = "#fbf8ee";
const UVA_T = "#6b3f8f";
const UVA_B = "#a9c25d";
const HOJA = "#6f9a55";
const PAJA = "#dcb65a";

const SUELO = 96;

type Gorro = "vincha" | "paja" | "boina" | "gorra";
type Punto = [number, number];

const OFICIO = {
  sake: { color: "#5d7388", gorro: "vincha" as Gorro },
  vino: { color: "#5f7d52", gorro: "boina" as Gorro },
  whisky: { color: "#8a6a4a", gorro: "gorra" as Gorro },
};

/** Personita. `x` es el centro de los pies; las manos van relativas a los pies. */
function Persona(props: {
  x: number;
  y?: number;
  oficio?: keyof typeof OFICIO;
  gorro?: Gorro;
  izq?: Punto;
  der?: Punto;
  mira?: 1 | -1;
}) {
  const { x, y = SUELO, oficio = "sake", izq = [-9, -17], der = [9, -17], mira = 1 } = props;
  const color = OFICIO[oficio].color;
  const gorro = props.gorro ?? OFICIO[oficio].gorro;
  const hx = x;
  const hy = y - 39;
  const brazo = (hombro: number, mano: Punto) => (
    <path
      d={`M${x + hombro} ${y - 28} L${x + mano[0]} ${y + mano[1]}`}
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  );
  return (
    <g>
      <path
        d={`M${x - 3} ${y - 13} L${x - 4} ${y} M${x + 3} ${y - 13} L${x + 4} ${y}`}
        stroke={TINTA}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {brazo(-6, izq)}
      <rect x={x - 7} y={y - 33} width={14} height={21} rx={6} fill={color} />
      {brazo(6, der)}
      <circle cx={x + izq[0]} cy={y + izq[1]} r={2.2} fill={PIEL} />
      <circle cx={x + der[0]} cy={y + der[1]} r={2.2} fill={PIEL} />
      <circle cx={hx} cy={hy} r={7} fill={PIEL} />
      <path d={`M${hx - 7} ${hy - 1} A7 7 0 0 1 ${hx + 7} ${hy - 1} Z`} fill={PELO} />
      <circle cx={hx - 2.5 + mira * 1.5} cy={hy + 1.8} r={0.9} fill={PELO} />
      <circle cx={hx + 2.5 + mira * 1.5} cy={hy + 1.8} r={0.9} fill={PELO} />
      <path
        d={`M${hx - 2 + mira} ${hy + 4.2} Q${hx + mira} ${hy + 5.8} ${hx + 2 + mira} ${hy + 4.2}`}
        stroke={PELO}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
      {gorro === "vincha" ? (
        <path
          d={`M${hx - 7} ${hy - 2} L${hx + 7} ${hy - 2} M${hx - 7 * mira} ${hy - 2} l${-4 * mira} 3`}
          stroke={ROJO}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ) : null}
      {gorro === "paja" ? (
        <g fill={PAJA}>
          <path d={`M${hx - 6} ${hy - 4} Q${hx} ${hy - 15} ${hx + 6} ${hy - 4} Z`} />
          <ellipse cx={hx} cy={hy - 4} rx={12} ry={2.6} />
        </g>
      ) : null}
      {gorro === "boina" ? <ellipse cx={hx - mira} cy={hy - 6} rx={8.5} ry={3.4} fill="#7a3040" /> : null}
      {gorro === "gorra" ? (
        <g>
          <path d={`M${hx - 7} ${hy - 3} Q${hx} ${hy - 13} ${hx + 7} ${hy - 3} Z`} fill="#5c574f" />
          <path
            d={`M${hx + 5 * mira} ${hy - 3} l${6 * mira} 1`}
            stroke="#5c574f"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </g>
      ) : null}
    </g>
  );
}

function T(props: { x: number; y: number; children: ReactNode; ancla?: "start" | "middle" | "end"; fuerte?: boolean }) {
  return (
    <text
      x={props.x}
      y={props.y}
      textAnchor={props.ancla ?? "middle"}
      fontSize={7.5}
      fontWeight={props.fuerte ? 700 : 500}
      fill={props.fuerte ? ROJO : TINTA}
    >
      {props.children}
    </text>
  );
}

function Flecha(props: { x1: number; y1: number; x2: number; y2: number }) {
  const { x1, y1, x2, y2 } = props;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const r = (n: number) => Math.round(n * 100) / 100;
  const p = (d: number) => `${r(x2 - 4 * Math.cos(a + d))} ${r(y2 - 4 * Math.sin(a + d))}`;
  return (
    <path
      d={`M${x1} ${y1} L${x2} ${y2} M${p(0.5)} L${x2} ${y2} L${p(-0.5)}`}
      stroke={LINEA}
      strokeWidth={1.3}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Tanque(props: {
  x: number;
  w: number;
  h: number;
  nivel?: number;
  liquido?: string;
  base?: number;
  patas?: number;
  madera?: boolean;
}) {
  const { x, w, h, nivel = 0.72, liquido = SAKE, base = SUELO, patas = 0, madera = false } = props;
  const top = base - patas - h;
  return (
    <g>
      {patas > 0 ? (
        <path
          d={`M${x + 5} ${base - patas} L${x + 5} ${base} M${x + w - 5} ${base - patas} L${x + w - 5} ${base}`}
          stroke={LINEA}
          strokeWidth={2}
        />
      ) : null}
      <rect
        x={x}
        y={top}
        width={w}
        height={h}
        rx={5}
        fill={madera ? MADERA : SUAVE}
        stroke={madera ? MADERA_OSC : LINEA}
        strokeWidth={1.2}
      />
      <rect x={x + 2.5} y={top + h * (1 - nivel)} width={w - 5} height={h * nivel - 2.5} rx={3} fill={liquido} />
      {madera ? (
        <path
          d={`M${x} ${top + h * 0.3} h${w} M${x} ${top + h * 0.75} h${w}`}
          stroke={MADERA_OSC}
          strokeWidth={1.6}
        />
      ) : null}
    </g>
  );
}

function Burbujas(props: { x: number; y: number; w: number; n?: number }) {
  const { x, y, w, n = 5 } = props;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle
          key={i}
          className="guia-burbuja"
          style={{ animationDelay: `${i * 0.37}s` }}
          cx={x + (i * w) / Math.max(1, n - 1)}
          cy={y - (i % 2) * 5}
          r={1.5 + (i % 3) * 0.5}
          fill="#ffffff"
          stroke={LINEA}
          strokeWidth={0.6}
        />
      ))}
    </g>
  );
}

function Vapor(props: { x: number; y: number; n?: number; paso?: number }) {
  const { x, y, n = 3, paso = 11 } = props;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          className="guia-vapor"
          style={{ animationDelay: `${i * 0.6}s` }}
          d={`M${x + i * paso} ${y} q-4 -5 0 -10 q4 -5 0 -10`}
          stroke={LINEA}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Gotas(props: { x: number; y: number; color: string; n?: number }) {
  const { x, y, color, n = 2 } = props;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          className="guia-gotea"
          style={{ animationDelay: `${i * 0.7}s` }}
          d={`M${x} ${y} q-2.4 3.4 0 5 q2.4 -1.6 0 -5 Z`}
          fill={color}
          stroke={TINTA}
          strokeWidth={0.4}
        />
      ))}
    </g>
  );
}

function Llama(props: { x: number; y: number; s?: number }) {
  const { x, y, s = 1 } = props;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="guia-llama">
        <path d="M0 0 C-7 -4 -4 -12 0 -17 C4 -12 7 -4 0 0 Z" fill="#e8902f" />
        <path d="M0 -1 C-3 -3 -2 -7 0 -10 C2 -7 3 -3 0 -1 Z" fill="#f6cf5a" />
      </g>
    </g>
  );
}

function Botella(props: { x: number; base?: number; h: number; color: string; tapon?: string; etiqueta?: boolean }) {
  const { x, base = SUELO, h, color, tapon = TINTA, etiqueta = true } = props;
  const w = h * 0.3;
  const hombro = base - h * 0.62;
  return (
    <g>
      <path
        d={`M${x - w / 2} ${base} L${x - w / 2} ${hombro} Q${x - w / 2} ${hombro - h * 0.1} ${x - w * 0.18} ${hombro - h * 0.16} L${x - w * 0.18} ${base - h * 0.95} L${x + w * 0.18} ${base - h * 0.95} L${x + w * 0.18} ${hombro - h * 0.16} Q${x + w / 2} ${hombro - h * 0.1} ${x + w / 2} ${hombro} L${x + w / 2} ${base} Z`}
        fill={color}
        stroke={TINTA}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <rect x={x - w * 0.22} y={base - h} width={w * 0.44} height={h * 0.09} rx={1} fill={tapon} />
      {etiqueta ? (
        <rect x={x - w / 2 + 1} y={base - h * 0.42} width={w - 2} height={h * 0.22} fill="#fffdf6" opacity={0.9} />
      ) : null}
    </g>
  );
}

/** Barrica vista de frente. */
function Barril(props: { cx: number; cy: number; r: number; interior?: string }) {
  const { cx, cy, r, interior } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={interior ?? MADERA} stroke={MADERA_OSC} strokeWidth={r * 0.16} />
      {interior ? null : (
        <>
          <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke={MADERA_OSC} strokeWidth={0.8} />
          <path
            d={`M${cx - r * 0.6} ${cy - r * 0.25} h${r * 1.2} M${cx - r * 0.6} ${cy + r * 0.25} h${r * 1.2}`}
            stroke={MADERA_OSC}
            strokeWidth={0.7}
          />
        </>
      )}
    </g>
  );
}

function Uvas(props: { x: number; y: number; color: string }) {
  const { x, y, color } = props;
  const granos: Punto[] = [
    [-3.4, 0],
    [0, 0],
    [3.4, 0],
    [-1.7, 3.2],
    [1.7, 3.2],
    [0, 6.4],
  ];
  return (
    <g>
      <path d={`M${x} ${y - 5} L${x} ${y - 1}`} stroke={MADERA_OSC} strokeWidth={1} />
      {granos.map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r={2.1} fill={color} stroke={TINTA} strokeWidth={0.3} />
      ))}
    </g>
  );
}

function Granos(props: { x: number; y: number; n: number; color: string; r?: number }) {
  const { x, y, n, color, r = 1.6 } = props;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <ellipse
          key={i}
          cx={x + (i % 6) * r * 2.3 + (Math.floor(i / 6) % 2) * r}
          cy={y - Math.floor(i / 6) * r * 1.5}
          rx={r}
          ry={r * 0.7}
          fill={color}
          stroke={LINEA}
          strokeWidth={0.4}
        />
      ))}
    </g>
  );
}

function Reloj(props: { x: number; y: number; texto: string }) {
  const { x, y, texto } = props;
  const w = Math.max(30, texto.length * 4.4 + 8);
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={19} rx={2.5} fill="#fffdf6" stroke={LINEA} strokeWidth={1} />
      <rect x={x - w / 2} y={y - 9} width={w} height={5.5} rx={2.5} fill={ROJO} />
      <T x={x} y={y + 6.5}>
        {texto}
      </T>
    </g>
  );
}

function Copo(props: { x: number; y: number }) {
  const { x, y } = props;
  return (
    <path
      d={`M${x - 5} ${y} h10 M${x} ${y - 5} v10 M${x - 3.5} ${y - 3.5} l7 7 M${x - 3.5} ${y + 3.5} l7 -7`}
      stroke={AGUA}
      strokeWidth={1.3}
      strokeLinecap="round"
    />
  );
}

/** Bacterias lácticas: bastoncitos rosados. */
function Bacterias(props: { puntos: Punto[] }) {
  return (
    <g>
      {props.puntos.map(([x, y], i) => (
        <rect
          key={i}
          className="guia-burbuja"
          style={{ animationDelay: `${i * 0.4}s` }}
          x={x}
          y={y}
          width={5.5}
          height={2.2}
          rx={1.1}
          fill="#d97f9a"
          transform={`rotate(${i % 2 ? 25 : -20} ${x} ${y})`}
        />
      ))}
    </g>
  );
}

function Bandera(props: { x: number; y: number }) {
  const { x, y } = props;
  return (
    <g>
      <rect x={x} y={y} width={18} height={12} rx={1} fill="#ffffff" stroke={LINEA} strokeWidth={0.8} />
      <circle cx={x + 9} cy={y + 6} r={3.4} fill={ROJO} />
      <T x={x + 9} y={y + 21}>
        Japón
      </T>
    </g>
  );
}

function Anfora(props: { x: number; w: number; h: number; liquido: string }) {
  const { x, w, h, liquido } = props;
  const top = SUELO - h;
  return (
    <g>
      <path
        d={`M${x + w * 0.3} ${SUELO} C${x - w * 0.12} ${SUELO - h * 0.35} ${x} ${top + h * 0.12} ${x + w * 0.25} ${top} L${x + w * 0.75} ${top} C${x + w} ${top + h * 0.12} ${x + w * 1.12} ${SUELO - h * 0.35} ${x + w * 0.7} ${SUELO} Z`}
        fill="#c9825a"
        stroke="#8f4f2a"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <ellipse cx={x + w / 2} cy={top} rx={w * 0.25} ry={3.5} fill={liquido} stroke="#8f4f2a" strokeWidth={1} />
    </g>
  );
}

/* ---------- Escenas genéricas ---------- */

function EscenaFermenta(props: {
  oficio: keyof typeof OFICIO;
  liquido: string;
  etiqueta: string;
  madera?: boolean;
  espuma?: boolean;
  extra?: ReactNode;
}) {
  const { oficio, liquido, etiqueta, madera = false, espuma = false, extra } = props;
  return (
    <>
      <Tanque x={98} w={56} h={60} nivel={0.78} liquido={liquido} madera={madera} />
      {espuma ? (
        <path
          d="M101 50 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 v4 h-48 Z"
          fill="#fffdf6"
          stroke={LINEA}
          strokeWidth={0.6}
        />
      ) : null}
      <Burbujas x={106} y={84} w={40} n={6} />
      <Burbujas x={112} y={70} w={28} n={4} />
      <Persona x={62} oficio={oficio} der={[13, -30]} izq={[10, -24]} />
      <rect x={70} y={62} width={11} height={14} rx={1.5} fill="#fffdf6" stroke={LINEA} strokeWidth={0.8} />
      <path d="M72.5 66 h6 M72.5 69 h6 M72.5 72 h4" stroke={LINEA} strokeWidth={0.7} />
      <T x={100} y={22}>
        {etiqueta}
      </T>
      {extra}
    </>
  );
}

function EscenaDiluir(props: { oficio: keyof typeof OFICIO; liquido: string; de: string; a: string }) {
  const { oficio, liquido, de, a } = props;
  return (
    <>
      <Tanque x={96} w={50} h={40} nivel={0.8} liquido={liquido} />
      <Persona x={70} oficio={oficio} der={[16, -40]} izq={[11, -34]} />
      <path d="M83 50 l14 -3 l1 7 l-13 5 Z" fill={ACERO} stroke={TINTA} strokeWidth={0.8} strokeLinejoin="round" />
      <Gotas x={101} y={53} color={AGUA} n={3} />
      <T x={52} y={24}>
        {de}
      </T>
      <Flecha x1={72} y1={21} x2={128} y2={21} />
      <T x={150} y={24} fuerte>
        {a}
      </T>
      <T x={121} y={50}>
        + agua
      </T>
    </>
  );
}

function EscenaEmbotellar(props: { oficio: keyof typeof OFICIO; color: string; h?: number; nota?: ReactNode }) {
  const { oficio, color, h = 30, nota } = props;
  return (
    <>
      <rect x={62} y={84} width={124} height={4} rx={2} fill={ACERO} stroke={LINEA} strokeWidth={0.8} />
      <path d="M70 88 v8 M178 88 v8" stroke={LINEA} strokeWidth={2} />
      <path d="M104 40 h14 v10 h-4 l-3 5 l-3 -5 h-4 Z" fill={ACERO} stroke={LINEA} strokeWidth={0.8} strokeLinejoin="round" />
      <Gotas x={111} y={56} color={color} n={2} />
      {[86, 111, 136, 161].map((x, i) => (
        <Botella key={x} x={x} base={84} h={h} color={color} etiqueta={i > 1} />
      ))}
      <Persona x={42} oficio={oficio} der={[16, -36]} izq={[12, -28]} />
      {nota}
    </>
  );
}

function EscenaPrensa(props: { oficio: keyof typeof OFICIO; jugo: string; relleno: string; etiqueta: string; canasta?: ReactNode }) {
  const { oficio, jugo, relleno, etiqueta, canasta } = props;
  return (
    <>
      <rect x={96} y={56} width={44} height={28} fill={MADERA} stroke={MADERA_OSC} strokeWidth={1.2} />
      <path d="M104 56 v28 M112 56 v28 M120 56 v28 M128 56 v28 M136 56 v28" stroke={MADERA_OSC} strokeWidth={0.7} />
      <rect x={99} y={60} width={38} height={7} fill={relleno} opacity={0.85} />
      <rect x={94} y={51} width={48} height={5} rx={1} fill={LINEA} />
      <path d="M118 51 V38" stroke={LINEA} strokeWidth={3} />
      <path d="M118 40 L82 62" stroke={TINTA} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={90} y={84} width={58} height={4} rx={1.5} fill={LINEA} />
      <path d="M148 86 h8" stroke={LINEA} strokeWidth={2.4} strokeLinecap="round" />
      <Gotas x={158} y={86} color={jugo} n={2} />
      <path d="M150 96 l2 -10 h14 l2 10 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1} strokeLinejoin="round" transform="translate(0 0)" />
      <path d="M152.6 96 l1.2 -5.5 h12.4 l1.2 5.5 Z" fill={jugo} />
      <Persona x={70} oficio={oficio} der={[12, -34]} izq={[8, -29]} />
      {canasta}
      <T x={160} y={76}>
        {etiqueta}
      </T>
    </>
  );
}

function EscenaMezcla(props: { oficio: keyof typeof OFICIO; colores: string[]; etiquetas: string[]; titulo: string }) {
  const { oficio, colores, etiquetas, titulo } = props;
  return (
    <>
      <Persona x={150} oficio={oficio} der={[-12, -38]} izq={[-10, -22]} mira={-1} />
      <path d="M134 52 l8 0 l-2 8 h-4 Z" fill={colores[colores.length - 1]} stroke={TINTA} strokeWidth={0.7} strokeLinejoin="round" />
      <path d="M138 60 v5 M135 65 h6" stroke={TINTA} strokeWidth={0.8} />
      <rect x={24} y={74} width={104} height={5} rx={1.5} fill={MADERA} stroke={MADERA_OSC} strokeWidth={0.8} />
      <path d="M32 79 v17 M120 79 v17" stroke={MADERA_OSC} strokeWidth={2.4} />
      {colores.slice(0, 3).map((c, i) => (
        <g key={i}>
          <Botella x={38 + i * 22} base={74} h={26} color={c} etiqueta={false} />
          <T x={38 + i * 22} y={i === 1 ? 33 : 42}>
            {etiquetas[i]}
          </T>
        </g>
      ))}
      <Flecha x1={90} y1={62} x2={102} y2={62} />
      <path d="M106 74 v-20 h16 v20 Z" fill="#fffdf6" stroke={TINTA} strokeWidth={0.9} strokeLinejoin="round" />
      <rect x={107} y={60} width={14} height={13.5} fill={colores[colores.length - 1]} />
      <T x={100} y={20}>
        {titulo}
      </T>
    </>
  );
}

function EscenaBarricas(props: {
  oficio: keyof typeof OFICIO;
  texto: string;
  etiquetas?: [string, string];
  extra?: ReactNode;
}) {
  const { oficio, texto, etiquetas, extra } = props;
  return (
    <>
      <Barril cx={112} cy={82} r={13} />
      <Barril cx={140} cy={82} r={13} />
      <Barril cx={168} cy={82} r={13} />
      <Barril cx={126} cy={59} r={13} />
      <Barril cx={154} cy={59} r={13} />
      {etiquetas ? (
        <>
          <T x={112} y={32}>
            {etiquetas[0]}
          </T>
          <T x={168} y={32}>
            {etiquetas[1]}
          </T>
          <path d="M140 26 v14" stroke={LINEA} strokeWidth={1} strokeDasharray="2 2" />
        </>
      ) : null}
      <Persona x={66} oficio={oficio} der={[14, -22]} izq={[13, -15]} />
      <g className="guia-rueda">
        <circle cx={86} cy={83} r={12} fill={MADERA} stroke={MADERA_OSC} strokeWidth={2} />
        <path d="M86 73 v20 M76 83 h20" stroke={MADERA_OSC} strokeWidth={0.8} />
      </g>
      <Reloj x={30} y={30} texto={texto} />
      {extra}
    </>
  );
}

/* ---------- Escenas por paso ---------- */

const ESCENAS: Record<string, (v?: string) => ReactNode> = {
  /* SAKE */
  "sake:pulido": (v) => {
    const queda = v === "daiginjo" ? 50 : v === "ginjo" ? 60 : 70;
    const escala = Math.sqrt(queda / 100);
    return (
      <>
        <ellipse cx={26} cy={66} rx={11} ry={16} fill="#d9c49a" stroke={MADERA_OSC} strokeWidth={1} />
        <T x={26} y={94}>
          100 %
        </T>
        <Persona x={66} der={[20, -40]} izq={[14, -34]} />
        <path d="M80 60 l12 -4 l1 5 l-11 6 Z" fill={MADERA} stroke={MADERA_OSC} strokeWidth={0.8} />
        <Granos x={88} y={52} n={3} color="#d9c49a" />
        <path d="M100 44 L136 44 L130 30 L106 30 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1.2} strokeLinejoin="round" />
        <rect x={96} y={44} width={44} height={52} rx={4} fill={SUAVE} stroke={LINEA} strokeWidth={1.2} />
        <g className="guia-gira">
          <circle cx={118} cy={68} r={13} fill="#fffdf6" stroke={TINTA} strokeWidth={1.4} strokeDasharray="5 3" />
          <circle cx={118} cy={68} r={2} fill={TINTA} />
        </g>
        <Flecha x1={144} y1={62} x2={158} y2={62} />
        <Granos x={143} y={94} n={Math.round((100 - queda) / 4)} color="#c9ad7a" r={1.3} />
        <ellipse cx={176} cy={62} rx={11 * escala} ry={16 * escala} fill={ARROZ} stroke={LINEA} strokeWidth={1} />
        <T x={176} y={94} fuerte>
          {queda} %
        </T>
      </>
    );
  },
  "sake:vapor": () => (
    <>
      <rect x={92} y={80} width={46} height={16} rx={2} fill={ACERO} stroke={LINEA} strokeWidth={1} />
      <rect x={106} y={85} width={18} height={11} rx={1} fill={TINTA} />
      <Llama x={115} y={96} s={0.55} />
      <rect x={88} y={54} width={54} height={26} fill={MADERA} stroke={MADERA_OSC} strokeWidth={1.2} />
      <path d="M88 62 h54 M88 72 h54" stroke={MADERA_OSC} strokeWidth={1.4} />
      <path d="M92 54 Q115 38 138 54 Z" fill={ARROZ} stroke={LINEA} strokeWidth={0.8} />
      <Vapor x={102} y={40} n={3} paso={13} />
      <Persona x={60} der={[18, -36]} izq={[13, -30]} />
      <path d="M68 68 L96 50" stroke={MADERA_OSC} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M94 47 l8 -1 l1 6 l-7 2 Z" fill={MADERA} stroke={MADERA_OSC} strokeWidth={0.7} />
      <Persona x={166} der={[-12, -30]} izq={[-14, -22]} mira={-1} />
      <path d="M150 62 l-12 -8 l10 -3 Z" fill="#fffdf6" stroke={LINEA} strokeWidth={0.8} strokeLinejoin="round" />
    </>
  ),
  "sake:koji": (v) => {
    const blanco = v === "koji-blanco";
    const espora = blanco ? "#c9c9c9" : "#8fae5a";
    return (
      <>
        <rect x={66} y={72} width={92} height={5} rx={1.5} fill={MADERA} stroke={MADERA_OSC} strokeWidth={0.8} />
        <path d="M74 77 v19 M150 77 v19" stroke={MADERA_OSC} strokeWidth={2.4} />
        <rect x={70} y={65} width={84} height={7} rx={3.5} fill={ARROZ} stroke={LINEA} strokeWidth={0.8} />
        <Persona x={48} der={[20, -44]} izq={[12, -32]} />
        <rect x={65} y={44} width={8} height={10} rx={1.5} fill={ACERO} stroke={TINTA} strokeWidth={0.7} />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            className="guia-gotea"
            style={{ animationDelay: `${i * 0.3}s` }}
            cx={74 + i * 7}
            cy={56 + (i % 2) * 2}
            r={1}
            fill={espora}
          />
        ))}
        <Persona x={176} der={[-16, -27]} izq={[-22, -26]} mira={-1} />
        <T x={108} y={30} fuerte={blanco}>
          {blanco ? "koji blanco" : "esporas de koji"}
        </T>
        <Flecha x1={92} y1={34} x2={84} y2={50} />
        <circle cx={112} cy={68.5} r={1} fill={espora} />
        <circle cx={126} cy={67.5} r={1} fill={espora} />
        <circle cx={138} cy={69} r={1} fill={espora} />
        {blanco ? (
          <>
            <ellipse cx={150} cy={26} rx={7} ry={5} fill="#f2d544" stroke={TINTA} strokeWidth={0.6} />
            <T x={150} y={42}>
              ácido cítrico
            </T>
          </>
        ) : null}
      </>
    );
  },
  "sake:shubo": (v) => {
    if (v === "kimoto" || v === "yamahai") {
      const kimoto = v === "kimoto";
      return (
        <>
          <path d="M84 96 l-5 -24 h82 l-5 24 Z" fill={MADERA} stroke={MADERA_OSC} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M81 82 h78" stroke={MADERA_OSC} strokeWidth={1.4} />
          <rect x={82} y={69} width={76} height={7} rx={3.5} fill={ARROZ} stroke={LINEA} strokeWidth={0.8} />
          <Bacterias
            puntos={[
              [96, 66],
              [112, 64],
              [128, 66],
              [144, 64],
            ]}
          />
          {kimoto ? (
            <>
              <Persona x={60} der={[16, -40]} izq={[11, -32]} />
              <g className="guia-vaiven">
                <path d="M72 50 L102 74" stroke={MADERA_OSC} strokeWidth={2.6} strokeLinecap="round" />
              </g>
              <Persona x={182} der={[-11, -32]} izq={[-16, -40]} mira={-1} />
              <g className="guia-vaiven-der">
                <path d="M170 50 L140 74" stroke={MADERA_OSC} strokeWidth={2.6} strokeLinecap="round" />
              </g>
              <T x={120} y={22} fuerte>
                se machaca el arroz
              </T>
            </>
          ) : (
            <>
              <Persona x={54} der={[-3, -22]} izq={[3, -21]} />
              <path d="M176 96 L186 44 M184 96 L178 44" stroke={MADERA_OSC} strokeWidth={2.4} strokeLinecap="round" />
              <path d="M172 58 l18 18 M190 58 l-18 18" stroke={ROJO} strokeWidth={2.2} strokeLinecap="round" />
              <T x={120} y={22} fuerte>
                sin machacar
              </T>
            </>
          )}
          <T x={120} y={34}>
            bacterias lácticas naturales
          </T>
          <Reloj x={24} y={32} texto="4 sem" />
        </>
      );
    }
    if (v === "bodaimoto") {
      return (
        <>
          <Tanque x={22} w={40} h={34} nivel={0.8} liquido="#dfe7cf" />
          <Granos x={28} y={91} n={10} color={ARROZ} r={2} />
          <Burbujas x={30} y={84} w={24} n={3} />
          <T x={42} y={50}>
            arroz crudo
          </T>
          <T x={42} y={58}>
            en agua
          </T>
          <Flecha x1={66} y1={82} x2={98} y2={82} />
          <T x={104} y={48} fuerte>
            agua ácida
          </T>
          <Tanque x={102} w={44} h={38} nivel={0.72} liquido="#f1e9cf" />
          <Burbujas x={110} y={86} w={28} n={4} />
          <Persona x={172} der={[-14, -30]} izq={[-9, -17]} mira={-1} />
        </>
      );
    }
    return (
      <>
        <Tanque x={100} w={44} h={38} nivel={0.72} liquido="#f1e9cf" />
        <Burbujas x={108} y={86} w={28} n={4} />
        <Persona x={74} der={[14, -40]} izq={[10, -32]} />
        <g className="guia-vaiven">
          <path d="M86 52 L120 84" stroke={MADERA_OSC} strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <Reloj x={170} y={40} texto="2 sem" />
        <T x={122} y={50}>
          levadura
        </T>
        <circle cx={112} cy={76} r={1.3} fill="#b9a05a" />
        <circle cx={126} cy={80} r={1.3} fill="#b9a05a" />
        <circle cx={132} cy={73} r={1.3} fill="#b9a05a" />
        <T x={40} y={30}>
          + ácido láctico
        </T>
        <Flecha x1={62} y1={34} x2={104} y2={56} />
      </>
    );
  },
  "sake:moromi": (v) => {
    const frio = v === "ginjo" || v === "daiginjo";
    return (
      <>
        <Tanque x={104} w={72} h={66} nivel={0.8} liquido={SAKE} />
        <Burbujas x={112} y={86} w={56} n={frio ? 4 : 7} />
        <Burbujas x={120} y={66} w={40} n={frio ? 2 : 5} />
        <rect x={70} y={62} width={36} height={4} rx={1} fill={LINEA} />
        <path d="M74 66 v30 M102 66 v30 M74 80 h28" stroke={LINEA} strokeWidth={1.6} />
        <Persona x={88} y={62} der={[16, -38]} izq={[11, -31]} />
        <g className="guia-vaiven">
          <path d="M102 22 L132 62" stroke={MADERA_OSC} strokeWidth={2.4} strokeLinecap="round" />
        </g>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={14 + i * 18} y={80} width={15} height={16} rx={4} fill="#fffdf6" stroke={LINEA} strokeWidth={1} />
            <T x={21.5 + i * 18} y={91}>
              {i + 1}
            </T>
          </g>
        ))}
        <T x={v === "kijoshu" ? 6 : 40} y={72} ancla={v === "kijoshu" ? "start" : "middle"} fuerte={v === "kijoshu"}>
          {v === "kijoshu" ? "sake en vez de agua" : v === "junmai" ? "" : "3 tandas"}
        </T>
        {frio ? (
          <>
            <Copo x={20} y={24} />
            <T x={30} y={27} ancla="start" fuerte>
              frío y lento
            </T>
          </>
        ) : null}
        {v === "junmai" ? (
          <>
            <g transform="rotate(20 30 40)">
              <Botella x={30} base={48} h={24} color="#fffdf6" etiqueta={false} />
            </g>
            <path d="M18 22 l24 26 M42 22 l-24 26" stroke={ROJO} strokeWidth={2.2} strokeLinecap="round" />
            <T x={6} y={62} ancla="start" fuerte>
              sin alcohol añadido
            </T>
          </>
        ) : null}
        {v === "kijoshu" ? (
          <>
            <Botella x={24} base={60} h={30} color="#6c8a5e" />
          </>
        ) : null}
      </>
    );
  },
  "sake:prensado": (v) => (
    <EscenaPrensa
      oficio="sake"
      jugo={SAKE}
      relleno="#fffdf6"
      etiqueta={v === "arabashiri" ? "arabashiri" : "sake"}
      canasta={
        <>
          <ellipse cx={30} cy={90} rx={14} ry={6} fill="#fffdf6" stroke={LINEA} strokeWidth={1} />
          <T x={30} y={78}>
            kasu
          </T>
          {v === "arabashiri" ? (
            <T x={118} y={28} fuerte>
              solo lo primero que cae
            </T>
          ) : null}
        </>
      }
    />
  ),
  "sake:carbon": () => (
    <>
      <path d="M92 40 L134 40 L121 64 L105 64 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1.2} strokeLinejoin="round" />
      {[
        [103, 46],
        [112, 48],
        [122, 45],
        [108, 54],
        [117, 55],
        [113, 60],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={2.2} fill={TINTA} />
      ))}
      <path d="M113 64 v8" stroke={LINEA} strokeWidth={3} />
      <Gotas x={113} y={73} color="#f7f3df" n={2} />
      <Tanque x={94} w={38} h={16} nivel={0.6} liquido="#f7f3df" />
      <Persona x={62} der={[18, -46]} izq={[13, -38]} />
      <path d="M76 44 l15 -3 l2 8 l-13 5 Z" fill={SUAVE} stroke={TINTA} strokeWidth={0.8} strokeLinejoin="round" />
      <path d="M91 45 q5 1 7 -3" stroke="#d9c98a" strokeWidth={2} fill="none" strokeLinecap="round" />
      <T x={160} y={52}>
        carbón
      </T>
      <Flecha x1={147} y1={50} x2={128} y2={50} />
    </>
  ),
  "sake:pasteurizacion": () => (
    <>
      <Tanque x={86} w={48} h={42} nivel={0.78} liquido={SAKE} patas={12} />
      <Llama x={98} y={96} s={0.6} />
      <Llama x={110} y={96} s={0.7} />
      <Llama x={122} y={96} s={0.6} />
      <Vapor x={100} y={36} n={2} paso={18} />
      <path d="M142 44 v30" stroke={TINTA} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M142 56 v18" stroke={ROJO} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={142} cy={77} r={4} fill={ROJO} stroke={TINTA} strokeWidth={0.8} />
      <T x={166} y={48} fuerte>
        65 °C
      </T>
      <Persona x={168} der={[-14, -32]} izq={[-9, -17]} mira={-1} />
      <Persona x={52} der={[9, -17]} izq={[-9, -17]} />
    </>
  ),
  "sake:reposo": (v) => {
    const liquido = v === "koshu" ? "#c9a24a" : SAKE;
    return (
      <>
        <Tanque x={92} w={46} h={60} nivel={0.82} liquido={liquido} />
        <Tanque x={144} w={40} h={50} nivel={0.82} liquido={liquido} />
        <g className="guia-vapor">
          <T x={112} y={28}>
            z z z
          </T>
        </g>
        <Persona x={56} der={[-3, -22]} izq={[3, -21]} />
        <Reloj x={26} y={34} texto={v === "koshu" ? "años" : "meses"} />
      </>
    );
  },
  "sake:dilucion": () => <EscenaDiluir oficio="sake" liquido={SAKE} de="17–20 %" a="15 %" />,
  "sake:embotellado": () => (
    <EscenaEmbotellar
      oficio="sake"
      color="#6c8a5e"
      nota={
        <>
          <Copo x={150} y={24} />
          <T x={170} y={27}>
            5 °C
          </T>
        </>
      }
    />
  ),
  "sake:alcohol": () => (
    <>
      <Tanque x={96} w={56} h={52} nivel={0.8} liquido={SAKE} />
      <Burbujas x={106} y={84} w={36} n={4} />
      <Persona x={70} der={[17, -44]} izq={[12, -36]} />
      <g transform="rotate(60 90 50)">
        <Botella x={90} base={58} h={18} color="#fffdf6" etiqueta={false} />
      </g>
      <Gotas x={101} y={48} color="#ffffff" n={2} />
      <T x={150} y={30} fuerte>
        + alcohol
      </T>
    </>
  ),

  /* VINO */
  "vino:vendimia": () => (
    <>
      <circle cx={24} cy={22} r={9} fill="#f1c453" />
      <path d="M96 96 V44 M186 96 V44 M96 50 H186" stroke={MADERA_OSC} strokeWidth={2} strokeLinecap="round" />
      {[108, 126, 144, 162, 178].map((x, i) => (
        <ellipse key={x} cx={x} cy={46 + (i % 2) * 3} rx={8} ry={5} fill={HOJA} />
      ))}
      <Uvas x={112} y={60} color={UVA_B} />
      <Uvas x={134} y={62} color={UVA_T} />
      <Uvas x={156} y={60} color={UVA_B} />
      <Uvas x={176} y={62} color={UVA_T} />
      <Persona x={84} oficio="vino" gorro="paja" der={[18, -38]} izq={[12, -26]} />
      <path d="M102 58 l5 -3 M102 58 l5 2" stroke={TINTA} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M40 96 l-3 -13 h28 l-3 13 Z" fill={PAJA} stroke={MADERA_OSC} strokeWidth={1} strokeLinejoin="round" />
      <Uvas x={46} y={78} color={UVA_T} />
      <Uvas x={55} y={77} color={UVA_B} />
    </>
  ),
  "vino:prensado-blanco": (v) => {
    const uva = v === "blanc-de-noirs" ? UVA_T : UVA_B;
    return (
      <EscenaPrensa
        oficio="vino"
        jugo={BLANCO}
        relleno={uva}
        etiqueta="mosto"
        canasta={
          <>
            <path d="M16 96 l-2 -12 h28 l-2 12 Z" fill={PAJA} stroke={MADERA_OSC} strokeWidth={1} strokeLinejoin="round" />
            <Uvas x={23} y={79} color={uva} />
            <Uvas x={33} y={78} color={uva} />
            <T x={118} y={28} fuerte={v === "blanc-de-noirs"}>
              {v === "blanc-de-noirs" ? "uva tinta, mosto blanco" : "sin pieles"}
            </T>
          </>
        }
      />
    );
  },
  "vino:desfangado": () => (
    <>
      <Tanque x={92} w={52} h={64} nivel={0.86} liquido="#e9e0a2" />
      <rect x={94.5} y={84} width={47} height={9.5} rx={3} fill="#a8905a" />
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          className="guia-gotea"
          style={{ animationDelay: `${i * 0.45}s` }}
          cx={102 + i * 11}
          cy={58 + (i % 2) * 8}
          r={1.3}
          fill="#a8905a"
        />
      ))}
      <Copo x={162} y={40} />
      <T x={162} y={56}>
        frío
      </T>
      <Persona x={58} oficio="vino" der={[4, -36]} izq={[9, -17]} />
      <T x={166} y={90}>
        fangos
      </T>
      <Flecha x1={152} y1={88} x2={143} y2={88} />
    </>
  ),
  "vino:fermentacion": (v) => (
    <EscenaFermenta
      oficio="vino"
      liquido={BLANCO}
      etiqueta={
        v === "minima-blanco"
          ? "con las levaduras de la uva"
          : v === "kabinett"
            ? "se frena antes: queda azúcar"
            : "azúcar → alcohol + CO₂"
      }
      extra={
        v === "kabinett" ? (
          <>
            <Copo x={174} y={50} />
            <rect x={168} y={66} width={6} height={6} fill="#ffffff" stroke={TINTA} strokeWidth={0.6} />
            <rect x={176} y={70} width={6} height={6} fill="#ffffff" stroke={TINTA} strokeWidth={0.6} />
            <T x={175} y={88}>
              azúcar
            </T>
          </>
        ) : null
      }
    />
  ),
  "vino:lias": () => (
    <>
      <Barril cx={124} cy={66} r={27} interior="#ece2a6" />
      <path d="M104 80 Q124 92 144 80 Q124 88 104 80 Z" fill="#b59a5e" />
      <path d="M103 79 Q124 96 145 79 L140 84 Q124 93 108 84 Z" fill="#b59a5e" />
      <rect x={121} y={36} width={6} height={5} fill={MADERA_OSC} />
      <rect x={62} y={84} width={26} height={12} rx={2} fill={MADERA} stroke={MADERA_OSC} strokeWidth={0.8} />
      <Persona x={75} y={84} oficio="vino" der={[20, -44]} izq={[15, -36]} />
      <g className="guia-vaiven">
        <path d="M92 36 L126 84" stroke={ACERO} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M92 36 L126 84" stroke={LINEA} strokeWidth={0.8} strokeLinecap="round" />
      </g>
      <T x={174} y={90}>
        lías
      </T>
      <Flecha x1={164} y1={88} x2={146} y2={85} />
    </>
  ),
  "vino:clarificado": () => (
    <>
      <Tanque x={18} w={34} h={44} nivel={0.8} liquido="#cfc28a" />
      <path d="M52 76 h22" stroke={LINEA} strokeWidth={3} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={76 + i * 7} y={58} width={5} height={30} rx={1} fill={i % 2 ? ACERO : "#fffdf6"} stroke={LINEA} strokeWidth={0.8} />
      ))}
      <path d="M72 56 h50 M72 90 h50" stroke={TINTA} strokeWidth={1.6} />
      <path d="M118 76 h18" stroke={LINEA} strokeWidth={3} />
      <Gotas x={138} y={76} color="#f3ecb4" n={2} />
      <Persona x={166} oficio="vino" der={[-6, -46]} izq={[-9, -17]} mira={-1} />
      <path d="M155 40 l9 0 l-2.2 9 h-4.6 Z" fill="#f3ecb4" stroke={TINTA} strokeWidth={0.7} strokeLinejoin="round" />
      <path d="M159.5 49 v5 M156.5 54 h6" stroke={TINTA} strokeWidth={0.8} />
      <path d="M148 30 l-5 -5 M159 26 v-7 M170 30 l5 -5" stroke="#f1c453" strokeWidth={1.4} strokeLinecap="round" />
      <T x={35} y={40}>
        turbio
      </T>
      <T x={128} y={68} fuerte>
        limpio
      </T>
    </>
  ),
  "vino:embotellado": (v) => (
    <EscenaEmbotellar
      oficio="vino"
      color="#5d7d54"
      nota={
        v ? (
          <T x={132} y={26} fuerte>
            sin filtrar, casi sin sulfuroso
          </T>
        ) : (
          <>
            <rect x={152} y={20} width={7} height={11} rx={2} fill="#d9b98a" stroke={MADERA_OSC} strokeWidth={0.7} />
            <T x={174} y={29}>
              corcho
            </T>
          </>
        )
      }
    />
  ),
  "vino:despalillado": () => (
    <>
      <path d="M84 40 L124 40 L116 54 L92 54 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1.2} strokeLinejoin="round" />
      <rect x={80} y={54} width={62} height={20} rx={10} fill={ACERO} stroke={LINEA} strokeWidth={1.2} />
      <g className="guia-gira">
        <path d="M111 58 v12 M105 64 h12" stroke={TINTA} strokeWidth={1.4} strokeLinecap="round" />
      </g>
      <path d="M90 74 v22 M132 74 v22" stroke={LINEA} strokeWidth={2} />
      <Persona x={56} oficio="vino" der={[20, -44]} izq={[14, -36]} />
      <path d="M70 50 l16 -6 l2 7 l-15 7 Z" fill={PAJA} stroke={MADERA_OSC} strokeWidth={0.8} strokeLinejoin="round" />
      <Uvas x={93} y={40} color={UVA_T} />
      <path d="M146 64 q10 -2 14 6" stroke={LINEA} strokeWidth={1.2} fill="none" strokeDasharray="2 2" />
      <path d="M150 96 l-2 -12 h30 l-2 12 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1} strokeLinejoin="round" />
      {[154, 160, 166, 172, 157, 163, 169].map((x, i) => (
        <circle key={i} cx={x} cy={i < 4 ? 82 : 78.5} r={2.6} fill={UVA_T} stroke={TINTA} strokeWidth={0.3} />
      ))}
      <T x={164} y={70}>
        granos
      </T>
      <path d="M14 94 l8 -10 m-4 5 l6 -1 M24 94 l6 -9 m-3 4 l5 0" stroke={HOJA} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <T x={24} y={76}>
        raspón
      </T>
    </>
  ),
  "vino:maceracion": (v) => {
    const liquido = v === "ligero" ? "#b9566f" : v === "guarda" ? "#5e1c30" : TINTO;
    return (
      <>
        {v === "qvevri" ? (
          <Anfora x={104} w={66} h={48} liquido={TINTO} />
        ) : (
          <>
            <Tanque x={98} w={78} h={46} nivel={0.86} liquido={liquido} madera />
            <path
              d="M101 56 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 v6 h-72 Z"
              fill={v === "ligero" ? "#7a3a66" : "#4d2147"}
            />
            <Burbujas x={110} y={88} w={54} n={6} />
          </>
        )}
        <rect x={62} y={70} width={36} height={4} rx={1} fill={LINEA} />
        <path d="M66 74 v22 M94 74 v22" stroke={LINEA} strokeWidth={1.6} />
        <Persona x={80} y={70} oficio="vino" der={[17, -36]} izq={[12, -29]} />
        <g className="guia-pisa">
          <path d="M94 30 L126 56" stroke={MADERA_OSC} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M120 58 l12 -6" stroke={MADERA_OSC} strokeWidth={4} strokeLinecap="round" />
        </g>
        <T x={150} y={26} fuerte={Boolean(v)}>
          {v === "qvevri"
            ? "ánfora de barro"
            : v === "minima-tinto"
              ? "levaduras de la uva"
              : v === "ligero"
                ? "extracción suave"
                : v === "guarda"
                  ? "más tiempo con pieles"
                  : "pieles = color + tanino"}
        </T>
        <Flecha x1={150} y1={30} x2={150} y2={46} />
        {v === "ligero" || v === "guarda" ? <Reloj x={30} y={30} texto={v === "ligero" ? "días" : "semanas"} /> : null}
      </>
    );
  },
  "vino:prensado-tinto": () => (
    <EscenaPrensa
      oficio="vino"
      jugo={TINTO}
      relleno="#4d2147"
      etiqueta="vino"
      canasta={
        <T x={118} y={30}>
          se separan las pieles
        </T>
      }
    />
  ),
  "vino:malolactica": () => (
    <>
      <Barril cx={150} cy={74} r={21} />
      <Persona x={104} oficio="vino" der={[-4, -36]} izq={[9, -17]} mira={-1} />
      <rect x={16} y={18} width={72} height={38} rx={8} fill="#fffdf6" stroke={LINEA} strokeWidth={1} />
      <path d="M78 56 l10 9 l-2 -10 Z" fill="#fffdf6" stroke={LINEA} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={34} cy={38} r={8} fill="#9cc25a" stroke={TINTA} strokeWidth={0.7} />
      <path d="M34 30 q2 -5 6 -5" stroke={MADERA_OSC} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Flecha x1={47} y1={38} x2={59} y2={38} />
      <path d="M66 28 h8 v4 l3 4 v12 h-14 v-12 l3 -4 Z" fill="#ffffff" stroke={TINTA} strokeWidth={0.8} strokeLinejoin="round" />
      <T x={34} y={68}>
        málico
      </T>
      <T x={70} y={68} fuerte>
        láctico
      </T>
    </>
  ),
  "vino:crianza-tinto": (v) => (
    <>
      {v === "qvevri" ? (
        <>
          <Anfora x={112} w={30} h={44} liquido={TINTO} />
          <Anfora x={150} w={30} h={44} liquido={TINTO} />
          <T x={146} y={36} fuerte>
            el barro no da sabor
          </T>
        </>
      ) : (
        <>
          <Barril cx={126} cy={82} r={13} />
          <Barril cx={154} cy={82} r={13} />
          <Barril cx={182} cy={82} r={13} />
          <Barril cx={140} cy={59} r={13} />
          <Barril cx={168} cy={59} r={13} />
        </>
      )}
      <Persona x={84} oficio="vino" der={[16, -36]} izq={[-8, -30]} />
      <path d="M100 60 L118 76" stroke={ACERO} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M100 60 L118 76" stroke={TINTO} strokeWidth={1} strokeLinecap="round" />
      <path d="M70 60 l9 0 l-2.2 8 h-4.6 Z" fill={TINTO} stroke={TINTA} strokeWidth={0.7} strokeLinejoin="round" />
      <path d="M74.5 68 v4 M71.5 72 h6" stroke={TINTA} strokeWidth={0.8} />
      <Reloj x={30} y={32} texto={v === "guarda" ? "años" : "meses"} />
    </>
  ),
  "vino:vino-base": () => <EscenaFermenta oficio="vino" liquido="#ece6ae" etiqueta="vino tranquilo, sin burbuja" />,
  "vino:assemblage": (v) => (
    <EscenaMezcla
      oficio="vino"
      colores={["#e9df9a", "#dccf78", "#cdbb5e", "#e0d488"]}
      etiquetas={
        v === "perpetua"
          ? ["nuevo", "", "solera"]
          : v === "blanc-de-blancs" || v === "millesime"
            ? ["", "", ""]
            : ["uvas", "parcelas", "reserva"]
      }
      titulo={
        v === "blanc-de-blancs"
          ? "solo chardonnay"
          : v === "perpetua"
            ? "un poco de todas las cosechas"
            : v === "millesime"
              ? "solo vinos de ese año"
              : "la mezcla define el estilo"
      }
    />
  ),
  "vino:tirage": () => (
    <>
      <Botella x={126} h={70} color="#6d8f62" etiqueta={false} tapon={ACERO} />
      <Burbujas x={119} y={88} w={14} n={4} />
      <Burbujas x={121} y={72} w={10} n={3} />
      <Persona x={60} oficio="vino" der={[18, -38]} izq={[12, -28]} />
      <rect x={76} y={54} width={7} height={7} fill="#ffffff" stroke={TINTA} strokeWidth={0.7} />
      <circle cx={88} cy={66} r={1.4} fill="#b9a05a" />
      <circle cx={92} cy={62} r={1.4} fill="#b9a05a" />
      <circle cx={93} cy={68} r={1.4} fill="#b9a05a" />
      <Flecha x1={96} y1={58} x2={112} y2={50} />
      <T x={72} y={24}>
        azúcar + levadura
      </T>
      <T x={168} y={60} fuerte>
        CO₂
      </T>
      <T x={168} y={70}>
        atrapado
      </T>
    </>
  ),
  "vino:crianza-lias": (v) => (
    <>
      {[0, 1, 2].map((fila) =>
        [0, 1, 2].map((col) => {
          const x = 84 + col * 34 + (fila % 2) * 8;
          const y = 84 - fila * 15;
          return (
            <g key={`${fila}-${col}`}>
              <rect x={x} y={y} width={24} height={10} rx={4.5} fill="#6d8f62" stroke={TINTA} strokeWidth={0.7} />
              <rect x={x + 24} y={y + 3} width={7} height={4} rx={1} fill="#6d8f62" stroke={TINTA} strokeWidth={0.7} />
              <path d={`M${x + 3} ${y + 8} h17`} stroke="#e9dfb0" strokeWidth={1.6} strokeLinecap="round" />
            </g>
          );
        })
      )}
      <Persona x={52} oficio="vino" der={[-3, -22]} izq={[3, -21]} />
      <Reloj x={24} y={30} texto={v === "millesime" ? "3 años" : "15 m+"} />
      <T x={150} y={30}>
        lías dentro de la botella
      </T>
    </>
  ),
  "vino:deguelle": () => (
    <>
      <path d="M22 96 L44 40 L66 96" stroke={MADERA_OSC} strokeWidth={3} fill="none" strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`rotate(150 ${38 + i * 2} ${58 + i * 13})`}>
          <Botella x={38 + i * 2} base={58 + i * 13} h={22} color="#6d8f62" etiqueta={false} />
        </g>
      ))}
      <Persona x={118} oficio="vino" der={[16, -30]} izq={[10, -22]} />
      <g transform="rotate(115 140 66)">
        <Botella x={140} base={66} h={30} color="#6d8f62" etiqueta={false} tapon="none" />
      </g>
      <circle cx={172} cy={80} r={2.2} fill="#cdb97a" className="guia-gotea" />
      <circle cx={178} cy={84} r={1.6} fill="#cdb97a" className="guia-gotea" style={{ animationDelay: "0.4s" }} />
      <path d="M166 70 l6 -4 M168 78 l8 0 M165 86 l6 5" stroke={ROJO} strokeWidth={1.3} strokeLinecap="round" />
      <T x={150} y={30}>
        salen las lías
      </T>
      <T x={44} y={30}>
        removido
      </T>
    </>
  ),
  "vino:dosage": (v) => (
    <>
      <Botella x={118} h={62} color="#6d8f62" etiqueta={false} tapon="none" />
      <Persona x={74} oficio="vino" der={[30, -52]} izq={[12, -28]} />
      <rect x={104} y={22} width={5} height={16} rx={1.5} fill="#fffdf6" stroke={TINTA} strokeWidth={0.7} transform="rotate(-25 106 30)" />
      <Gotas x={116} y={26} color="#e3b14e" n={2} />
      <path d="M156 60 q0 -8 7 -8 q7 0 7 8 v10 h-14 Z" fill="#d9b98a" stroke={MADERA_OSC} strokeWidth={0.8} strokeLinejoin="round" />
      <path d="M153 70 h20 M156 70 l-2 8 M170 70 l2 8" stroke={LINEA} strokeWidth={1} fill="none" />
      <T x={163} y={92}>
        corcho
      </T>
      <T x={160} y={28} fuerte>
        {v === "brut-nature" ? "0–3 g/L" : v === "extra-brut" ? "hasta 6 g/L" : v === "brut" ? "hasta 12 g/L" : "0–12 g/L"}
      </T>
      {v === "brut-nature" ? (
        <T x={160} y={40}>
          sin azúcar
        </T>
      ) : null}
      {(v === "brut" ? [0, 1] : v === "extra-brut" ? [0] : []).map((i) => (
        <rect key={i} x={152 + i * 10} y={34} width={7} height={7} fill="#ffffff" stroke={TINTA} strokeWidth={0.6} />
      ))}
    </>
  ),
  "vino:fermentacion-seco": () => <EscenaFermenta oficio="vino" liquido="#ece6ae" etiqueta="hasta seco: 0 azúcar" />,
  "vino:encabezado": () => <EscenaAgregar oficio="vino" liquido="#ece6ae" texto="→ 15 %" />,
  "vino:flor": () => (
    <>
      <Barril cx={128} cy={60} r={33} interior="#fffdf6" />
      <path d="M99 52 A30 30 0 0 0 157 52 Z" fill="#e6d68a" />
      <path d="M98.5 52 q5 -5 10 0 q5 -5 10 0 q5 -5 10 0 q5 -5 10 0 q5 -5 10 0 q5 -5 9.5 0 v3 h-59.5 Z" fill="#ffffff" stroke={LINEA} strokeWidth={0.6} />
      <T x={128} y={44}>
        aire
      </T>
      <T x={128} y={72}>
        vino
      </T>
      <Persona x={52} oficio="vino" der={[16, -34]} izq={[-9, -17]} />
      <T x={30} y={30} fuerte>
        velo de flor
      </T>
      <Flecha x1={44} y1={34} x2={100} y2={50} />
    </>
  ),
  "vino:saca": () => (
    <>
      <Barril cx={148} cy={72} r={23} />
      <Persona x={84} oficio="vino" der={[14, -46]} izq={[-13, -28]} />
      <path d="M98 50 L112 20" stroke={TINTA} strokeWidth={1.4} strokeLinecap="round" />
      <rect x={109} y={13} width={7} height={8} rx={1} fill={ACERO} stroke={TINTA} strokeWidth={0.7} />
      <path d="M110 20 Q84 30 72 62" stroke="#e6d68a" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeDasharray="3 2" className="guia-fluye" />
      <path d="M66 62 l10 0 l-2.4 9 h-5.2 Z" fill="#e6d68a" stroke={TINTA} strokeWidth={0.7} strokeLinejoin="round" />
      <path d="M71 71 v5 M68 76 h6" stroke={TINTA} strokeWidth={0.8} />
      <T x={36} y={30}>
        venencia
      </T>
      <Flecha x1={52} y1={28} x2={104} y2={22} />
    </>
  ),

  /* WHISKY */
  "whisky:malteado": (v) => (
    <>
      <rect x={14} y={88} width={104} height={8} rx={3} fill="#e0c078" stroke={MADERA_OSC} strokeWidth={0.7} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${20 + i * 8.4} 88 q1 -5 4 -6`} stroke={HOJA} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      ))}
      <Persona x={52} oficio="whisky" der={[16, -30]} izq={[10, -24]} />
      <g className="guia-vaiven">
        <path d="M64 62 L92 86" stroke={MADERA_OSC} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M87 88 l10 -6" stroke={MADERA_OSC} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <T x={62} y={24}>
        germina
      </T>
      <Flecha x1={98} y1={21} x2={126} y2={21} />
      <path d="M134 96 V60 L158 36 L182 60 V96 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1.2} strokeLinejoin="round" />
      <rect x={152} y={26} width={12} height={12} fill={SUAVE} stroke={LINEA} strokeWidth={1.2} />
      {v === "peated" ? (
        <g stroke="#5c574f">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              className="guia-vapor"
              style={{ animationDelay: `${i * 0.5}s` }}
              d={`M${152 + i * 6} 24 q-5 -5 0 -10 q5 -5 0 -10`}
              strokeWidth={2.6}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      ) : (
        <Vapor x={154} y={24} n={2} paso={8} />
      )}
      <Llama x={158} y={94} s={0.8} />
      {v === "peated" ? (
        <>
          <rect x={142} y={89} width={10} height={6} rx={1} fill="#4a3a2c" />
          <rect x={164} y={89} width={10} height={6} rx={1} fill="#4a3a2c" />
        </>
      ) : null}
      <rect x={140} y={66} width={36} height={4} rx={1.5} fill="#e0c078" />
      <T x={v === "peated" ? 104 : 182} y={v === "peated" ? 44 : 24} fuerte={v === "peated"}>
        {v === "peated" ? "humo de turba" : "se seca"}
      </T>
    </>
  ),
  "whisky:maceracion": () => (
    <>
      <Tanque x={92} w={74} h={44} nivel={0.8} liquido="#d8b86a" />
      <path d="M129 40 v48" stroke={TINTA} strokeWidth={2} />
      <g className="guia-desliza">
        <path d="M104 78 h50 M112 78 v7 M124 78 v7 M134 78 v7 M146 78 v7" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />
      </g>
      <path d="M60 34 h44 v14" stroke={ROJO} strokeWidth={3} fill="none" strokeLinejoin="round" />
      <Gotas x={104} y={50} color="#e58b6a" n={3} />
      <Vapor x={140} y={48} n={2} paso={12} />
      <Persona x={56} oficio="whisky" der={[12, -52]} izq={[9, -17]} />
      <circle cx={66} cy={40} r={5.5} fill="#fffdf6" stroke={ROJO} strokeWidth={1.6} />
      <T x={148} y={26}>
        agua caliente
      </T>
    </>
  ),
  "whisky:fermentacion": (v) => (
    <EscenaFermenta
      oficio="whisky"
      liquido="#cda85a"
      etiqueta="una cerveza sin lúpulo"
      madera
      espuma
      extra={v === "japanese" ? <Bandera x={168} y={40} /> : null}
    />
  ),
  "whisky:pot-still": (v) => (
    <>
      <path
        d="M72 86 C52 86 52 58 78 54 C82 46 84 40 86 28 L96 28 C98 40 100 46 104 54 C130 58 130 86 110 86 Z"
        fill={COBRE}
        stroke="#8f4f2a"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M91 28 C91 14 122 14 140 30" stroke={COBRE} strokeWidth={5} fill="none" strokeLinecap="round" />
      <rect x={134} y={30} width={18} height={38} rx={4} fill={ACERO} stroke={LINEA} strokeWidth={1.2} />
      <path d="M138 38 h10 M138 46 h10 M138 54 h10 M138 62 h10" stroke={COBRE} strokeWidth={1.6} />
      <path d="M143 68 v6" stroke={LINEA} strokeWidth={3} />
      <Gotas x={143} y={75} color="#ffffff" n={2} />
      <path d="M133 96 l2 -12 h16 l2 12 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1} strokeLinejoin="round" />
      <rect x={64} y={86} width={54} height={10} rx={2} fill={TINTA} />
      <Llama x={80} y={96} s={0.55} />
      <Llama x={91} y={96} s={0.65} />
      <Llama x={102} y={96} s={0.55} />
      <Persona x={30} oficio="whisky" der={[-3, -22]} izq={[3, -21]} />
      <Persona x={176} oficio="whisky" der={[-14, -26]} izq={[-9, -17]} mira={-1} />
      <T x={172} y={26} fuerte>
        × 2
      </T>
      {v === "japanese" ? <Bandera x={12} y={12} /> : null}
    </>
  ),
  "whisky:barrica": (v) => (
    <EscenaBarricas
      oficio="whisky"
      texto={v === "new-born" ? "< 3 años" : "3 años +"}
      extra={v === "japanese" ? <Bandera x={170} y={12} /> : null}
    />
  ),
  "whisky:reduccion": () => <EscenaDiluir oficio="whisky" liquido={WHISKY} de="≈ 60 %" a="43 %" />,
  "whisky:embotellado": () => <EscenaEmbotellar oficio="whisky" color={WHISKY} h={24} />,
  "whisky:malta": () => (
    <>
      <path
        d="M112 86 C96 86 96 64 116 61 C119 55 121 50 122 40 L130 40 C131 50 133 55 136 61 C156 64 156 86 140 86 Z"
        fill={COBRE}
        stroke="#8f4f2a"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M126 40 C126 28 150 28 164 40 V60" stroke={COBRE} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <Gotas x={164} y={64} color={WHISKY} n={2} />
      <rect x={104} y={86} width={44} height={10} rx={2} fill={TINTA} />
      <Llama x={126} y={96} s={0.6} />
      <Persona x={60} oficio="whisky" der={[14, -30]} izq={[-9, -17]} />
      <Granos x={20} y={92} n={14} color="#e0c078" r={2} />
      <T x={30} y={74}>
        cebada
      </T>
      <T x={126} y={22} fuerte>
        pot still
      </T>
    </>
  ),
  "whisky:grano": () => (
    <>
      <rect x={112} y={22} width={22} height={74} rx={4} fill={ACERO} stroke={LINEA} strokeWidth={1.2} />
      {[32, 42, 52, 62, 72, 82].map((y) => (
        <path key={y} d={`M114 ${y} h18`} stroke={LINEA} strokeWidth={1.1} />
      ))}
      <Burbujas x={118} y={88} w={10} n={3} />
      <path d="M134 30 h18 v40" stroke={LINEA} strokeWidth={3} fill="none" strokeLinejoin="round" />
      <Gotas x={152} y={72} color="#f3e6b8" n={3} />
      <path d="M142 96 l2 -12 h16 l2 12 Z" fill={SUAVE} stroke={LINEA} strokeWidth={1} strokeLinejoin="round" />
      <Persona x={72} oficio="whisky" der={[14, -30]} izq={[-9, -17]} />
      <Granos x={16} y={92} n={12} color="#f1d264" r={2.2} />
      <T x={30} y={74}>
        maíz, trigo
      </T>
      <T x={170} y={40} fuerte>
        columna
      </T>
      <T x={174} y={50}>
        continua
      </T>
    </>
  ),
  "whisky:barrica-separado": () => (
    <EscenaBarricas oficio="whisky" texto="años" etiquetas={["malta", "grano"]} />
  ),
  "whisky:mezcla": () => (
    <EscenaMezcla
      oficio="whisky"
      colores={["#b8792c", "#d39a3c", "#ecc56a", "#d7a548"]}
      etiquetas={["malta", "malta", "grano"]}
      titulo="el blender busca el equilibrio"
    />
  ),
};

function EscenaAgregar(props: { oficio: keyof typeof OFICIO; liquido: string; texto: string }) {
  const { oficio, liquido, texto } = props;
  return (
    <>
      <Tanque x={96} w={56} h={52} nivel={0.8} liquido={liquido} />
      <Persona x={70} oficio={oficio} der={[17, -44]} izq={[12, -36]} />
      <g transform="rotate(60 90 50)">
        <Botella x={90} base={58} h={18} color="#fffdf6" etiqueta={false} />
      </g>
      <Gotas x={101} y={48} color="#ffffff" n={2} />
      <T x={150} y={26}>
        + alcohol vínico
      </T>
      <T x={170} y={70} fuerte>
        {texto}
      </T>
    </>
  );
}

export const CLAVES_ILUSTRACION = Object.keys(ESCENAS);

export function tieneIlustracion(proceso: string, paso: string): boolean {
  return `${proceso}:${paso}` in ESCENAS;
}

/** Dibujo del paso. `apagada` lo muestra tachado (el paso no se hace). */
export function IlustracionPaso(props: {
  proceso: string;
  paso: string;
  titulo: string;
  /** Término elegido que cambia este paso: algunas escenas tienen una versión propia. */
  termino?: string;
  apagada?: boolean;
}) {
  const escena = ESCENAS[`${props.proceso}:${props.paso}`];
  if (!escena) {
    return null;
  }
  return (
    <svg
      viewBox="0 0 200 110"
      role="img"
      aria-label={`Dibujo: ${props.titulo}`}
      className="block h-auto w-full rounded-lg"
      style={{ background: FONDO, fontFamily: "inherit" }}
    >
      <g opacity={props.apagada ? 0.35 : 1}>
        <path d={`M8 ${SUELO} H192`} stroke={SUAVE} strokeWidth={2} strokeLinecap="round" />
        {escena(props.termino)}
      </g>
      {props.apagada ? (
        <path d="M24 16 L176 94 M176 16 L24 94" stroke={ROJO} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      ) : null}
    </svg>
  );
}
