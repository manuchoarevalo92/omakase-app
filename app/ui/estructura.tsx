"use client";

import { ChevronRight, CircleHelp } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BotonIcono } from "./controles";
import { cx, vibrar } from "./haptica";
import { Hoja } from "./hoja";

/* ---------------- Pantalla ---------------- */

/**
 * Esqueleto de cada pantalla: título grande que, al scrollear, se convierte en una
 * barra compacta fija (como en iOS). Las instrucciones van a `ayuda` (botón "?")
 * en vez de ocupar el encabezado.
 */
export function Pantalla(props: {
  titulo: string;
  subtitulo?: ReactNode;
  ayuda?: ReactNode;
  /** Botones a la derecha del título (BotonIcono o Boton chico). */
  acciones?: ReactNode;
  ancho?: "normal" | "amplio";
  children: ReactNode;
}) {
  const {
    titulo,
    subtitulo,
    ayuda,
    acciones,
    ancho = "normal",
    children,
  } = props;
  const marca = useRef<HTMLDivElement>(null);
  const [compacta, setCompacta] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  useEffect(() => {
    const el = marca.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setCompacta(!e.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const botones = (
    <>
      {ayuda ? (
        <BotonIcono
          etiqueta="Cómo funciona"
          variante="plano"
          icono={<CircleHelp className="h-[22px] w-[22px]" aria-hidden />}
          onClick={() => setAyudaAbierta(true)}
        />
      ) : null}
      {acciones}
    </>
  );

  return (
    <main className="min-w-0 flex-1 bg-surface text-label">
      <div
        aria-hidden={!compacta}
        className={cx(
          "fixed inset-x-0 top-0 z-40 border-b bg-material pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl backdrop-saturate-150 transition-[opacity,border-color] duration-200 sm:hidden",
          compacta
            ? "border-separator opacity-100"
            : "pointer-events-none border-transparent opacity-0",
        )}
      >
        <div className="flex h-11 items-center justify-center px-14">
          <p className="truncate text-[1rem] font-semibold">{titulo}</p>
        </div>
      </div>

      <div
        className={cx(
          "mx-auto w-full px-4 pb-10 sm:px-6",
          ancho === "amplio" ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        <header className="flex items-end gap-3 pb-4 pt-5 sm:pt-8">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.01em] text-label">
              {titulo}
            </h1>
            {subtitulo ? (
              <p className="mt-1 text-[0.94rem] text-label-2">{subtitulo}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
            {botones}
          </div>
        </header>
        <div ref={marca} className="h-px" aria-hidden />
        {children}
      </div>

      {ayuda ? (
        <Hoja
          abierta={ayudaAbierta}
          onCerrar={() => setAyudaAbierta(false)}
          titulo={`Cómo funciona ${titulo}`}
        >
          <div className="space-y-3 pb-2 text-[0.97rem] leading-relaxed text-label-2">
            {ayuda}
          </div>
        </Hoja>
      ) : null}
    </main>
  );
}

/* ---------------- Sección y lista agrupada ---------------- */

export function Seccion(props: {
  titulo?: ReactNode;
  accion?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { titulo, accion, pie, children, className } = props;
  return (
    <section className={cx("mt-6 first:mt-2", className)}>
      {titulo || accion ? (
        <div className="mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
          {titulo ? (
            <h2 className="text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          {accion}
        </div>
      ) : null}
      {children}
      {pie ? (
        <p className="mt-2 px-1 text-[0.82rem] leading-snug text-label-3">
          {pie}
        </p>
      ) : null}
    </section>
  );
}

export function Lista(props: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cx(
        "overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        props.className,
      )}
    >
      {props.children}
    </ul>
  );
}

export type AccionFila = {
  label: string;
  icono?: ReactNode;
  tono?: "peligro" | "exito" | "neutro";
  onClick: () => void;
};

const TONO_ACCION = {
  peligro: "bg-danger text-[#fff]",
  exito: "bg-success text-[#fff]",
  neutro: "bg-[#8a847a] text-[#fff]",
};

/**
 * Fila de lista. Con `href` u `onClick` se vuelve tocable (con chevron).
 * `acciones` aparecen al deslizar hacia la izquierda, como en Mail.
 */
export function Fila(props: {
  titulo: ReactNode;
  detalle?: ReactNode;
  valor?: ReactNode;
  icono?: ReactNode;
  href?: string;
  onClick?: () => void;
  acciones?: AccionFila[];
  chevron?: boolean;
}) {
  const {
    titulo,
    detalle,
    valor,
    icono,
    href,
    onClick,
    acciones = [],
    chevron,
  } = props;
  const [dx, setDx] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const inicio = useRef<{ x: number; y: number; base: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dxActual = useRef(0);
  const mover = (valor: number) => {
    dxActual.current = valor;
    setDx(valor);
  };
  const anchoAcciones = acciones.length * 78;
  const tocable = Boolean(href || onClick);

  const contenido = (
    <>
      {icono ? (
        <span className="flex size-9 shrink-0 items-center justify-center">
          {icono}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 py-3">
        <span className="block truncate text-[1rem] leading-snug text-label">
          {titulo}
        </span>
        {detalle ? (
          <span className="mt-0.5 block truncate text-[0.86rem] text-label-3">
            {detalle}
          </span>
        ) : null}
      </span>
      {valor ? (
        <span className="shrink-0 text-right text-[0.95rem] tabular-nums text-label-2">
          {valor}
        </span>
      ) : null}
      {(chevron ?? tocable) ? (
        <ChevronRight
          className="h-[18px] w-[18px] shrink-0 text-label-3"
          aria-hidden
        />
      ) : null}
    </>
  );

  const clases =
    "flex min-h-14 w-full items-center gap-3 bg-surface-3 pl-4 pr-3 text-left transition-colors";

  const cerrar = () => {
    setAbierta(false);
    mover(0);
  };

  return (
    <li className="relative overflow-hidden border-b border-separator last:border-0 [&:last-child]:border-0">
      {acciones.length > 0 && (dx !== 0 || abierta) ? (
        <div
          className="absolute inset-y-0 right-0 flex"
          style={{ width: anchoAcciones }}
          aria-hidden={!abierta}
        >
          {acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              tabIndex={abierta ? 0 : -1}
              onClick={() => {
                vibrar();
                cerrar();
                a.onClick();
              }}
              className={cx(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[0.78rem] font-semibold",
                TONO_ACCION[a.tono ?? "neutro"],
              )}
            >
              {a.icono}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={cx(
          "relative",
          acciones.length > 0 && "touch-pan-y",
          dx === 0 || abierta
            ? "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            : "",
        )}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={(e) => {
          if (!acciones.length) return;
          inicio.current = {
            x: e.clientX,
            y: e.clientY,
            base: abierta ? -anchoAcciones : 0,
          };
          horizontal.current = null;
        }}
        onPointerMove={(e) => {
          const i = inicio.current;
          if (!i) return;
          const mx = e.clientX - i.x;
          const my = e.clientY - i.y;
          if (
            horizontal.current === null &&
            (Math.abs(mx) > 8 || Math.abs(my) > 8)
          ) {
            horizontal.current = Math.abs(mx) > Math.abs(my);
            if (horizontal.current) {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* puntero ya liberado */
              }
            }
          }
          if (horizontal.current) {
            setAbierta(false);
            mover(Math.min(0, Math.max(-anchoAcciones - 24, i.base + mx)));
          }
        }}
        onPointerUp={() => {
          if (!inicio.current) return;
          inicio.current = null;
          if (horizontal.current) {
            const abrir = dxActual.current < -anchoAcciones / 2;
            if (abrir) vibrar();
            setAbierta(abrir);
            mover(abrir ? -anchoAcciones : 0);
          }
        }}
        onPointerCancel={() => {
          inicio.current = null;
          mover(abierta ? -anchoAcciones : 0);
        }}
        onClickCapture={(e) => {
          if (abierta || horizontal.current) {
            e.preventDefault();
            e.stopPropagation();
            horizontal.current = null;
            if (abierta) cerrar();
          }
        }}
      >
        {href ? (
          <Link href={href} className={cx(clases, "active:bg-fill")}>
            {contenido}
          </Link>
        ) : onClick ? (
          <button
            type="button"
            onClick={() => {
              vibrar();
              onClick();
            }}
            className={cx(clases, "active:bg-fill")}
          >
            {contenido}
          </button>
        ) : (
          <div className={clases}>{contenido}</div>
        )}
      </div>
    </li>
  );
}

/* ---------------- Estado vacío y esqueletos ---------------- */

export function EstadoVacio(props: {
  icono?: ReactNode;
  titulo: string;
  texto?: ReactNode;
  accion?: ReactNode;
}) {
  const { icono, titulo, texto, accion } = props;
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icono ? (
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-fill text-label-3">
          {icono}
        </span>
      ) : null}
      <p className="text-[1.06rem] font-semibold text-label">{titulo}</p>
      {texto ? (
        <p className="mt-1.5 max-w-xs text-[0.94rem] leading-relaxed text-label-2">
          {texto}
        </p>
      ) : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}

export function Esqueleto(props: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "ui-esqueleto block rounded-lg",
        props.className ?? "h-4 w-full",
      )}
    />
  );
}

/** Lista de N filas falsas mientras carga (en vez de un spinner). */
export function EsqueletoLista(props: { filas?: number }) {
  const n = props.filas ?? 5;
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="overflow-hidden rounded-card bg-surface-3"
    >
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="flex min-h-14 items-center gap-3 border-b border-separator px-4 last:border-0"
        >
          <Esqueleto className="size-9 rounded-full" />
          <div className="flex-1 space-y-2 py-3">
            <Esqueleto className="h-3.5" />
            <Esqueleto className={i % 2 ? "h-3 w-1/3" : "h-3 w-1/2"} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Etiqueta (pill de estado) ---------------- */

const TONO_ETIQUETA = {
  neutro: "bg-fill text-label-2",
  acento: "bg-accent-soft text-accent",
  exito: "bg-success-soft text-success",
  alerta: "bg-warning-soft text-warning",
  peligro: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Etiqueta(props: {
  tono?: keyof typeof TONO_ETIQUETA;
  icono?: ReactNode;
  children: ReactNode;
}) {
  const { tono = "neutro", icono, children } = props;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.76rem] font-semibold",
        TONO_ETIQUETA[tono],
      )}
    >
      {icono}
      {children}
    </span>
  );
}
