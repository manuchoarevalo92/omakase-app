"use client";

import { useId, type ReactNode } from "react";

import {
  BLANCO,
  Botella,
  Copo,
  FONDO,
  Flecha,
  LINEA,
  Llama,
  MADERA,
  MADERA_OSC,
  PIEL,
  Persona,
  ROJO,
  SAKE,
  SUAVE,
  SUELO,
  T,
  TINTA,
  Vapor,
} from "./ilustraciones";

/**
 * Dibujos de la sección Servicio: la barra, quien sirve (de oscuro) y el
 * comensal. Mismo tamaño y paleta que los de Elaboración (200×110, papel claro).
 */

const BARRA_Y = 67;
const BARRA_FIN = 122;
const VIDRIO = "#ffffff";
const BOTELLA_SAKE = "#cfdcca";
const VERDE = "#4f8a4a";

/** Barra vista de costado. Se dibuja después del comensal, así le tapa las piernas. */
function Barra(props: { desde?: number; hasta?: number }) {
  const { desde = 12, hasta = BARRA_FIN } = props;
  return (
    <g>
      <rect
        x={desde}
        y={BARRA_Y + 3}
        width={hasta - desde}
        height={SUELO - BARRA_Y - 3}
        fill={MADERA}
      />
      <rect
        x={desde - 2}
        y={BARRA_Y}
        width={hasta - desde + 4}
        height={4}
        rx={1.5}
        fill={MADERA_OSC}
      />
    </g>
  );
}

/** Copa de vino. `nivel` va de 0 (vacía) a 1 (llena hasta el borde). */
function Copa(props: {
  x: number;
  base: number;
  nivel?: number;
  liquido?: string;
  escala?: number;
}) {
  const { x, base, nivel = 0, liquido = BLANCO, escala = 1 } = props;
  const id = useId();
  const tope = base - 32;
  const fondo = base - 12;
  const caliz = `M${x - 9} ${tope} C${x - 10} ${base - 18} ${x - 4} ${base - 13} ${x} ${fondo} C${x + 4} ${base - 13} ${x + 10} ${base - 18} ${x + 9} ${tope} Z`;
  const ly = fondo - nivel * (fondo - tope);
  return (
    <g
      transform={
        escala === 1
          ? undefined
          : `translate(${x} ${base}) scale(${escala}) translate(${-x} ${-base})`
      }
    >
      <clipPath id={id}>
        <path d={caliz} />
      </clipPath>
      {nivel > 0 ? (
        <rect
          x={x - 11}
          y={ly}
          width={22}
          height={fondo - ly + 1}
          fill={liquido}
          clipPath={`url(#${id})`}
        />
      ) : null}
      <path
        d={caliz}
        fill={VIDRIO}
        fillOpacity={0.35}
        stroke={TINTA}
        strokeWidth={0.8}
      />
      <path
        d={`M${x} ${fondo} L${x} ${base - 1}`}
        stroke={TINTA}
        strokeWidth={1}
      />
      <ellipse
        cx={x}
        cy={base - 0.8}
        rx={6}
        ry={1.4}
        fill={VIDRIO}
        stroke={TINTA}
        strokeWidth={0.8}
      />
    </g>
  );
}

/** Jarrita de sake. */
function Tokkuri(props: { x: number; base: number; h?: number }) {
  const { x, base, h = 24 } = props;
  return (
    <g>
      <path
        d={`M${x - 2.5} ${base - h} L${x - 2.5} ${base - h * 0.7} C${x - 9} ${base - h * 0.55} ${x - 10} ${base - 2} ${x - 6} ${base} L${x + 6} ${base} C${x + 10} ${base - 2} ${x + 9} ${base - h * 0.55} ${x + 2.5} ${base - h * 0.7} L${x + 2.5} ${base - h} Z`}
        fill="#efe9dd"
        stroke={TINTA}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <path
        d={`M${x - 8.4} ${base - h * 0.3} H${x + 8.4}`}
        stroke="#4a6a8c"
        strokeWidth={1.6}
      />
    </g>
  );
}

/** Vasito de sake (ochoko). */
function Ochoko(props: { x: number; base: number; lleno?: boolean }) {
  const { x, base, lleno = false } = props;
  return (
    <g>
      <path
        d={`M${x - 4.5} ${base - 6} L${x + 4.5} ${base - 6} L${x + 3} ${base} L${x - 3} ${base} Z`}
        fill="#efe9dd"
        stroke={TINTA}
        strokeWidth={0.7}
      />
      {lleno ? (
        <path
          d={`M${x - 3.8} ${base - 4.6} H${x + 3.8}`}
          stroke="#d8cc94"
          strokeWidth={1.6}
        />
      ) : null}
    </g>
  );
}

/** Globo de diálogo. `cola` indica hacia qué lado apunta. */
function Globo(props: {
  x: number;
  y: number;
  w: number;
  texto: string;
  cola?: "izq" | "der";
}) {
  const { x, y, w, texto, cola = "izq" } = props;
  const cx = cola === "izq" ? x + 8 : x + w - 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={14}
        rx={7}
        fill="#fffdf6"
        stroke={LINEA}
        strokeWidth={0.8}
      />
      <path
        d={`M${cx - 3} ${y + 13.6} L${cx + (cola === "izq" ? -4 : 4)} ${y + 20} L${cx + 3} ${y + 13.6}`}
        fill="#fffdf6"
        stroke={LINEA}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <rect x={cx - 3.4} y={y + 12.6} width={6.8} height={1.6} fill="#fffdf6" />
      <T x={x + w / 2} y={y + 9.6}>
        {texto}
      </T>
    </g>
  );
}

function Bien(props: { x: number; y: number }) {
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={7} fill={VERDE} />
      <path
        d={`M${props.x - 3.4} ${props.y} l2.4 2.6 l4.6 -5`}
        stroke="#fff"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Mal(props: { x: number; y: number }) {
  return (
    <g>
      <circle cx={props.x} cy={props.y} r={7} fill={ROJO} />
      <path
        d={`M${props.x - 3} ${props.y - 3} l6 6 M${props.x + 3} ${props.y - 3} l-6 6`}
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Lito: servilleta blanca doblada. */
function Lito(props: { x: number; y: number }) {
  const { x, y } = props;
  return (
    <g>
      <rect
        x={x - 6}
        y={y}
        width={12}
        height={8}
        rx={1}
        fill="#fffdf6"
        stroke={LINEA}
        strokeWidth={0.6}
      />
      <path d={`M${x - 6} ${y + 3} h12`} stroke={SUAVE} strokeWidth={0.8} />
    </g>
  );
}

function Sacacorchos(props: { x: number; y: number }) {
  const { x, y } = props;
  return (
    <g>
      <rect
        x={x - 11}
        y={y - 3}
        width={22}
        height={5}
        rx={2.5}
        fill={MADERA_OSC}
      />
      <path
        d={`M${x} ${y + 2} q3 2 0 4 q-3 2 0 4 q3 2 0 4 q-3 2 0 4`}
        stroke="#9aa0a6"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Botella inclinada sirviendo, con el chorro hasta la copa. */
function Sirviendo(props: {
  x: number;
  y: number;
  color: string;
  chorro: string;
  hasta: number;
  h?: number;
}) {
  const { x, y, color, chorro, hasta, h = 34 } = props;
  return (
    <g>
      <path
        d={`M${x - 3} ${y + 2} Q${x - 5} ${(y + hasta) / 2} ${x - 4} ${hasta}`}
        stroke={chorro}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      <g transform={`rotate(-118 ${x} ${y})`}>
        <Botella x={x} base={y + h} h={h} color={color} />
      </g>
    </g>
  );
}

function Celular(props: { x: number; y: number; formato: string }) {
  const { x, y, formato } = props;
  const celda = (cx: number, cy: number, activo = false) => (
    <rect
      key={`${cx}-${cy}`}
      x={cx}
      y={cy}
      width={6}
      height={6}
      rx={1.4}
      fill={activo ? ROJO : SUAVE}
    />
  );
  return (
    <g>
      <rect x={x} y={y} width={44} height={74} rx={6} fill="#2f3440" />
      <rect x={x + 3} y={y + 5} width={38} height={64} rx={3} fill="#fffdf6" />
      {/* Barra en L con los asientos. */}
      {Array.from({ length: 4 }, (_, i) =>
        celda(x + 13 + i * 7, y + 9, i === 1),
      )}
      {celda(x + 6, y + 17)}
      {celda(x + 6, y + 24)}
      <path
        d={`M${x + 13} ${y + 16.5} H${x + 41} M${x + 13} ${y + 16.5} V${y + 30}`}
        stroke={SUAVE}
        strokeWidth={1.6}
      />
      <rect x={x + 6} y={y + 36} width={30} height={5} rx={1.5} fill={SUAVE} />
      <rect x={x + 6} y={y + 45} width={10} height={7} rx={1.5} fill={SUAVE} />
      <rect x={x + 18} y={y + 45} width={18} height={7} rx={2} fill={ROJO} />
      <text
        x={x + 27}
        y={y + 50.4}
        textAnchor="middle"
        fontSize={4.6}
        fontWeight={700}
        fill="#fff"
      >
        {formato}
      </text>
    </g>
  );
}

const ESCENAS: Record<string, () => ReactNode> = {
  "b-copa": () => (
    <>
      <Copa x={58} base={92} nivel={0.3} escala={1.9} />
      <ellipse
        cx={58}
        cy={76}
        rx={5}
        ry={3.4}
        fill={PIEL}
        stroke={TINTA}
        strokeWidth={0.5}
      />
      <Bien x={82} y={24} />
      <T x={58} y={104}>
        por el tallo
      </T>
      <Copa x={142} base={92} nivel={0.3} escala={1.9} />
      <ellipse
        cx={142}
        cy={52}
        rx={11}
        ry={6}
        fill={PIEL}
        stroke={TINTA}
        strokeWidth={0.5}
      />
      <Mal x={166} y={24} />
      <T x={142} y={104}>
        por el cáliz, no
      </T>
    </>
  ),
  "b-equipo": () => (
    <>
      <Persona x={66} oficio="sala" izq={[-12, -24]} der={[11, -30]} />
      <Lito x={54} y={71} />
      <T x={30} y={60}>
        lito
      </T>
      <Flecha x1={34} y1={63} x2={48} y2={71} />
      <Sacacorchos x={140} y={44} />
      <T x={140} y={76}>
        sacacorchos
      </T>
      <T x={140} y={86}>
        de mozo
      </T>
    </>
  ),
  "b-conocer": () => (
    <>
      <Persona x={56} oficio="sala" izq={[-10, -22]} der={[12, -30]} />
      <Botella x={68} base={70} h={26} color={BOTELLA_SAKE} />
      <Globo x={76} y={18} w={112} texto="Junmai ginjo, fresco y floral" />
      <Globo x={98} y={54} w={84} texto="Lo consulto y le cuento" cola="izq" />
    </>
  ),
  "b-moverse": () => (
    <>
      <Persona x={34} oficio="cliente" mira={1} />
      <Persona x={78} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={52} base={BARRA_Y} />
      <Persona
        x={156}
        oficio="sala"
        mira={-1}
        izq={[-14, -36]}
        der={[-6, -22]}
      />
      <path
        d="M140 58 C110 40 80 40 56 46"
        stroke={ROJO}
        strokeWidth={1.4}
        fill="none"
        strokeDasharray="3 2"
      />
      <Mal x={96} y={30} />
      <T x={96} y={18}>
        por delante de otro, no
      </T>
    </>
  ),
  "b-anotar": () => (
    <>
      <Persona x={64} oficio="sala" izq={[-10, -24]} der={[16, -36]} />
      <Celular x={86} y={18} formato="Copa" />
      <T x={162} y={50}>
        asiento,
      </T>
      <T x={162} y={60}>
        cantidad
      </T>
      <T x={162} y={70}>
        y formato
      </T>
    </>
  ),

  "vb-presentar": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Persona
        x={150}
        oficio="sala"
        mira={-1}
        izq={[-32, -38]}
        der={[-24, -28]}
      />
      <g transform="rotate(-62 112 60)">
        <Botella x={112} base={76} h={36} color={BLANCO} />
      </g>
      <Lito x={122} y={64} />
      <Globo x={70} y={12} w={96} texto="Petit Chablis 2023" cola="der" />
    </>
  ),
  "vb-abrir": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Botella x={100} base={BARRA_Y} h={34} color={BLANCO} />
      <rect
        x={97.6}
        y={25}
        width={4.8}
        height={9}
        rx={1}
        fill="#d9b98a"
        stroke={TINTA}
        strokeWidth={0.5}
      />
      <Sacacorchos x={100} y={20} />
      <Persona
        x={130}
        oficio="sala"
        mira={-1}
        izq={[-20, -76]}
        der={[-24, -46]}
      />
      <T x={58} y={24}>
        despacio,
      </T>
      <T x={58} y={33}>
        sin ruido
      </T>
    </>
  ),
  "vb-probar": () => (
    <>
      <Persona
        x={40}
        oficio="cliente"
        mira={1}
        izq={[-4, -24]}
        der={[12, -40]}
      />
      <Copa x={54} base={62} nivel={0.12} />
      <Vapor x={44} y={24} n={2} paso={6} />
      <Barra />
      <Persona
        x={150}
        oficio="sala"
        mira={-1}
        izq={[-10, -22]}
        der={[8, -22]}
      />
      <Botella x={140} base={77} h={30} color={BLANCO} />
      <Globo x={70} y={12} w={70} texto="un sorbo" cola="izq" />
      <T x={100} y={50}>
        ¿está sano?
      </T>
    </>
  ),
  "vb-servir": () => (
    <>
      <Persona x={34} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={66} base={BARRA_Y} nivel={0.34} />
      <Copa x={104} base={BARRA_Y} nivel={0.2} />
      <Sirviendo x={112} y={30} color={BLANCO} chorro="#e3d77c" hasta={47} />
      <Persona
        x={138}
        oficio="sala"
        mira={-1}
        izq={[-12, -72]}
        der={[-6, -60]}
      />
      <path d="M78 46 H84" stroke={ROJO} strokeWidth={1.2} />
      <T x={84} y={40} fuerte>
        ⅓
      </T>
      <T x={150} y={104}>
        el anfitrión, al final
      </T>
    </>
  ),
  "vb-gota": () => (
    <>
      <g transform="rotate(-100 96 44)">
        <Botella x={96} base={88} h={56} color={BLANCO} />
      </g>
      <path
        d="M80 60 A13 13 0 1 1 74 34"
        stroke={ROJO}
        strokeWidth={1.6}
        fill="none"
      />
      <Flecha x1={78} y1={33} x2={73} y2={34} />
      <T x={62} y={82}>
        girá y levantá
      </T>
      <Lito x={156} y={60} />
      <T x={156} y={80}>
        secá el pico
      </T>
    </>
  ),
  "vb-seguir": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={70} base={BARRA_Y} nivel={0.1} />
      <Persona
        x={150}
        oficio="sala"
        mira={-1}
        izq={[-14, -30]}
        der={[8, -22]}
      />
      <Botella x={132} base={70} h={32} color={BLANCO} />
      <Globo x={82} y={14} w={86} texto="¿Les sirvo más?" cola="der" />
    </>
  ),

  "vc-copa": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={96} base={BARRA_Y} />
      <Persona
        x={140}
        oficio="sala"
        mira={-1}
        izq={[-40, -36]}
        der={[-6, -24]}
      />
      <Flecha x1={120} y1={30} x2={104} y2={36} />
    </>
  ),
  "vc-mostrar": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={70} base={BARRA_Y} />
      <Persona
        x={150}
        oficio="sala"
        mira={-1}
        izq={[-32, -38]}
        der={[-24, -28]}
      />
      <g transform="rotate(-62 112 60)">
        <Botella x={112} base={76} h={36} color={BOTELLA_SAKE} />
      </g>
      <Globo x={64} y={12} w={102} texto="Kido Daiginjo 40" cola="der" />
    </>
  ),
  "vc-medida": () => (
    <>
      <Copa x={60} base={92} nivel={0.32} escala={1.9} />
      <Copa x={140} base={92} nivel={0.32} escala={1.9} />
      <path
        d="M30 51 H170"
        stroke={ROJO}
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <T x={100} y={60} fuerte>
        =
      </T>
      <T x={100} y={22}>
        la medida de la casa
      </T>
    </>
  ),
  "vc-anotar": () => (
    <>
      <Persona x={64} oficio="sala" izq={[-10, -24]} der={[16, -36]} />
      <Celular x={86} y={18} formato="Copa" />
    </>
  ),

  "sc-temperatura": () => (
    <>
      <Copa x={44} base={88} nivel={0.3} liquido={SAKE} escala={1.3} />
      <Copo x={44} y={24} />
      <T x={44} y={104}>
        frío
      </T>
      <Copa x={100} base={88} nivel={0.3} liquido={SAKE} escala={1.3} />
      <circle
        cx={100}
        cy={24}
        r={4.5}
        fill="none"
        stroke={LINEA}
        strokeWidth={1.2}
      />
      <T x={100} y={104}>
        ambiente
      </T>
      <Tokkuri x={156} base={88} h={30} />
      <Llama x={156} y={30} s={0.8} />
      <T x={156} y={104}>
        tibio
      </T>
    </>
  ),
  "sc-presentar": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Persona
        x={150}
        oficio="sala"
        mira={-1}
        izq={[-32, -38]}
        der={[-24, -28]}
      />
      <g transform="rotate(-62 112 60)">
        <Botella x={112} base={76} h={36} color={BOTELLA_SAKE} />
      </g>
      <Globo x={70} y={12} w={96} texto="Junmai daiginjo" cola="der" />
    </>
  ),
  "sc-servir": () => (
    <>
      <Persona x={34} oficio="cliente" mira={1} />
      <Barra />
      <Copa x={104} base={BARRA_Y} nivel={0.22} liquido={SAKE} />
      <Sirviendo
        x={112}
        y={30}
        color={BOTELLA_SAKE}
        chorro="#d8cc94"
        hasta={50}
      />
      <Persona
        x={138}
        oficio="sala"
        mira={-1}
        izq={[-12, -72]}
        der={[-6, -60]}
      />
    </>
  ),

  "st-llevar": () => (
    <>
      <Persona x={70} oficio="sala" mira={1} izq={[22, -34]} der={[42, -34]} />
      <rect x={86} y={60} width={54} height={3} rx={1.5} fill={MADERA_OSC} />
      <Tokkuri x={98} base={60} h={22} />
      <Ochoko x={116} base={60} />
      <Ochoko x={130} base={60} />
      <T x={150} y={84}>
        uno por persona
      </T>
    </>
  ),
  "st-servir": () => (
    <>
      <Persona x={36} oficio="cliente" mira={1} />
      <Barra />
      <Ochoko x={106} base={BARRA_Y} />
      <g transform="rotate(-112 110 36)">
        <Tokkuri x={110} base={58} h={22} />
      </g>
      <path
        d="M109 38 Q107 50 106 61"
        stroke="#d8cc94"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Persona
        x={142}
        oficio="sala"
        mira={-1}
        izq={[-22, -66]}
        der={[-16, -56]}
      />
      <T x={56} y={24}>
        con las
      </T>
      <T x={56} y={33}>
        dos manos
      </T>
    </>
  ),
  "st-entre-ellos": () => (
    <>
      <Persona x={40} oficio="cliente" mira={1} />
      <Persona
        x={100}
        oficio="cliente"
        mira={-1}
        izq={[-17, -58]}
        der={[-10, -50]}
      />
      <Barra />
      <Ochoko x={62} base={BARRA_Y} />
      <g transform="rotate(-108 64 44)">
        <Tokkuri x={64} base={64} h={20} />
      </g>
      <path
        d="M64 46 Q63 54 62 61"
        stroke="#d8cc94"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      <T x={162} y={44}>
        se sirven
      </T>
      <T x={162} y={54}>
        entre ellos
      </T>
    </>
  ),
  "st-kanpai": () => (
    <>
      <Persona
        x={52}
        oficio="cliente"
        mira={1}
        izq={[-6, -22]}
        der={[14, -48]}
      />
      <Persona
        x={112}
        oficio="cliente"
        mira={-1}
        izq={[-14, -48]}
        der={[6, -22]}
      />
      <Barra desde={20} hasta={150} />
      <Ochoko x={70} base={46} lleno />
      <Ochoko x={94} base={46} lleno />
      <path
        d="M78 34 l4 -5 M82 36 l6 -3 M84 40 l6 0"
        stroke={ROJO}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Globo x={118} y={14} w={60} texto="¡Kanpai!" cola="izq" />
    </>
  ),
  "st-anotar": () => (
    <>
      <Persona x={64} oficio="sala" izq={[-10, -24]} der={[16, -36]} />
      <Celular x={86} y={18} formato="Tokkuri" />
    </>
  ),
};

export function tieneDibujoServicio(id: string): boolean {
  return id in ESCENAS;
}

export function DibujoServicio(props: { id: string; titulo: string }) {
  const escena = ESCENAS[props.id];
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
      <path
        d={`M8 ${SUELO} H192`}
        stroke={SUAVE}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {escena()}
    </svg>
  );
}
