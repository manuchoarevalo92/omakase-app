"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import {
  forwardRef,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cx, vibrar } from "./haptica";
import { Hoja } from "./hoja";

/* ---------------- Botón ---------------- */

type Variante = "primario" | "secundario" | "terciario" | "peligro";

const VARIANTE: Record<Variante, string> = {
  primario:
    "bg-accent text-on-accent shadow-[0_1px_0_rgb(255_255_255/0.12)_inset] hover:brightness-[1.06]",
  secundario: "bg-fill text-label hover:bg-fill-strong",
  terciario: "bg-transparent text-accent hover:bg-accent-soft",
  peligro: "bg-danger-soft text-danger hover:brightness-[1.04]",
};

export const Boton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variante?: Variante;
    tamano?: "chico" | "normal" | "grande";
    icono?: ReactNode;
    cargando?: boolean;
    ancho?: boolean;
  }
>(function Boton(props, ref) {
  const {
    variante = "primario",
    tamano = "normal",
    icono,
    cargando = false,
    ancho = false,
    className,
    children,
    disabled,
    onClick,
    type = "button",
    ...resto
  } = props;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      onClick={(e) => {
        vibrar();
        onClick?.(e);
      }}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        tamano === "chico" && "min-h-9 px-3 text-[0.88rem]",
        tamano === "normal" && "min-h-11 px-4 text-[0.97rem]",
        tamano === "grande" && "min-h-[3.25rem] px-5 text-[1.03rem]",
        ancho && "w-full",
        VARIANTE[variante],
        className,
      )}
      {...resto}
    >
      {cargando ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
      ) : (
        icono
      )}
      {children}
    </button>
  );
});

/** Botón redondo de solo ícono (requiere etiqueta para lectores de pantalla). */
export function BotonIcono(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    etiqueta: string;
    icono: ReactNode;
    variante?: "fill" | "plano";
  },
) {
  const {
    etiqueta,
    icono,
    variante = "fill",
    className,
    onClick,
    ...resto
  } = props;
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={(e) => {
        vibrar();
        onClick?.(e);
      }}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition active:scale-95 disabled:opacity-40",
        variante === "fill" ? "bg-fill hover:bg-fill-strong" : "hover:bg-fill",
        className,
      )}
      {...resto}
    >
      {icono}
    </button>
  );
}

/* ---------------- Campos ---------------- */

const CAMPO =
  "w-full min-h-12 rounded-control bg-fill px-3.5 text-[1rem] text-label outline-none ring-accent/60 transition placeholder:text-label-3 focus:bg-surface-3 focus:ring-2 disabled:opacity-50";

function Envoltura(props: {
  id: string;
  label?: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}) {
  const { id, label, ayuda, error, children } = props;
  return (
    <div className="min-w-0">
      {label ? (
        <label
          htmlFor={id}
          className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2"
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 pl-1 text-[0.82rem] text-danger">{error}</p>
      ) : ayuda ? (
        <p className="mt-1.5 pl-1 text-[0.82rem] text-label-3">{ayuda}</p>
      ) : null}
    </div>
  );
}

export const Campo = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    ayuda?: string;
    error?: string;
    icono?: ReactNode;
  }
>(function Campo(props, ref) {
  const { label, ayuda, error, icono, id, className, ...resto } = props;
  const auto = useId();
  const idCampo = id ?? auto;
  return (
    <Envoltura id={idCampo} label={label} ayuda={ayuda} error={error}>
      <div className="relative">
        {icono ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-label-3">
            {icono}
          </span>
        ) : null}
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={error ? true : undefined}
          className={cx(
            CAMPO,
            icono ? "pl-10" : "",
            error ? "ring-2 ring-danger/60" : "",
            className,
          )}
          {...resto}
        />
      </div>
    </Envoltura>
  );
});

export function CampoBusqueda(
  props: InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string },
) {
  const { etiqueta = "Buscar", placeholder = "Buscar", ...resto } = props;
  return (
    <Campo
      type="search"
      aria-label={etiqueta}
      placeholder={placeholder}
      icono={<Search className="h-[18px] w-[18px]" aria-hidden />}
      enterKeyHint="search"
      {...resto}
    />
  );
}

export function AreaTexto(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    ayuda?: string;
    error?: string;
  },
) {
  const { label, ayuda, error, id, className, ...resto } = props;
  const auto = useId();
  const idCampo = id ?? auto;
  return (
    <Envoltura id={idCampo} label={label} ayuda={ayuda} error={error}>
      <textarea
        id={idCampo}
        className={cx(CAMPO, "py-3 leading-relaxed", className)}
        rows={4}
        {...resto}
      />
    </Envoltura>
  );
}

/* ---------------- Segmentado ---------------- */

export function Segmentado<T extends string>(props: {
  opciones: { valor: T; label: ReactNode }[];
  valor: T;
  onChange: (valor: T) => void;
  etiqueta: string;
}) {
  const { opciones, valor, onChange, etiqueta } = props;
  const indice = Math.max(
    0,
    opciones.findIndex((o) => o.valor === valor),
  );
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="relative grid rounded-[0.85rem] bg-fill p-[3px]"
      style={{
        gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden
        className="absolute bottom-[3px] top-[3px] rounded-[0.7rem] bg-surface-3 shadow-[0_1px_3px_rgb(0_0_0/0.14)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          left: 3,
          width: `calc((100% - 6px) / ${opciones.length})`,
          transform: `translateX(${indice * 100}%)`,
        }}
      />
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => {
              if (!activo) vibrar();
              onChange(o.valor);
            }}
            className={cx(
              "relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[0.7rem] px-2 text-[0.92rem] transition-colors",
              activo ? "font-semibold text-label" : "text-label-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Contador ---------------- */

export function Contador(props: {
  valor: number;
  onChange: (valor: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  unidad?: string;
  etiqueta: string;
}) {
  const {
    valor,
    onChange,
    min = 0,
    max = Number.POSITIVE_INFINITY,
    paso = 1,
    unidad,
    etiqueta,
  } = props;
  const cambiar = (delta: number) => {
    const nuevo = Math.min(
      max,
      Math.max(min, Math.round((valor + delta) * 1000) / 1000),
    );
    if (nuevo !== valor) {
      vibrar();
      onChange(nuevo);
    }
  };
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="inline-flex items-center rounded-full bg-fill p-1"
    >
      <button
        type="button"
        aria-label={`Restar ${paso}`}
        disabled={valor <= min}
        onClick={() => cambiar(-paso)}
        className="inline-flex size-10 items-center justify-center rounded-full text-label transition active:scale-90 active:bg-fill-strong disabled:opacity-30"
      >
        <Minus className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className="min-w-14 px-1 text-center font-mono text-[1.05rem] tabular-nums text-label"
      >
        {valor.toLocaleString("es-ES")}
        {unidad ? (
          <span className="ml-1 font-sans text-[0.8rem] text-label-3">
            {unidad}
          </span>
        ) : null}
      </output>
      <button
        type="button"
        aria-label={`Sumar ${paso}`}
        disabled={valor >= max}
        onClick={() => cambiar(paso)}
        className="inline-flex size-10 items-center justify-center rounded-full text-label transition active:scale-90 active:bg-fill-strong disabled:opacity-30"
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </div>
  );
}

/* ---------------- Selector (reemplazo de <select>) ---------------- */

export type OpcionSelector<T extends string> = {
  valor: T;
  label: string;
  detalle?: string;
  grupo?: string;
};

export function Selector<T extends string>(props: {
  label?: string;
  titulo?: string;
  opciones: OpcionSelector<T>[];
  valor: T | null;
  onChange: (valor: T) => void;
  placeholder?: string;
  /** Muestra un buscador arriba de la lista (útil con más de ~10 opciones). */
  buscar?: boolean;
  ayuda?: string;
}) {
  const {
    label,
    titulo,
    opciones,
    valor,
    onChange,
    placeholder = "Elegir…",
    buscar,
    ayuda,
  } = props;
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const id = useId();
  const actual = opciones.find((o) => o.valor === valor) ?? null;

  const filtradas = useMemo(() => {
    const n = q.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (!n) return opciones;
    return opciones.filter((o) =>
      `${o.label} ${o.detalle ?? ""}`
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(n),
    );
  }, [opciones, q]);

  const cerrar = () => {
    setAbierto(false);
    setQ("");
  };

  return (
    <Envoltura id={id} label={label} ayuda={ayuda}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          vibrar();
          setAbierto(true);
        }}
        className={cx(
          CAMPO,
          "flex items-center justify-between gap-2 text-left",
        )}
      >
        <span className={cx("truncate", actual ? "" : "text-label-3")}>
          {actual ? actual.label : placeholder}
        </span>
        <ChevronDown
          className="h-[18px] w-[18px] shrink-0 text-label-3"
          aria-hidden
        />
      </button>
      <Hoja
        abierta={abierto}
        onCerrar={cerrar}
        titulo={titulo ?? label ?? "Elegir"}
        alto={opciones.length > 8 ? "alta" : "auto"}
      >
        {buscar ? (
          <div className="sticky top-0 z-10 -mx-4 bg-surface-2 px-4 pb-2">
            <CampoBusqueda
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
        ) : null}
        <ul
          role="listbox"
          aria-label={titulo ?? label}
          className="overflow-hidden rounded-card bg-surface-3"
        >
          {filtradas.map((o, i) => {
            const sel = o.valor === valor;
            const cabecera =
              o.grupo && o.grupo !== filtradas[i - 1]?.grupo ? o.grupo : null;
            return (
              <li key={o.valor} role="option" aria-selected={sel}>
                {cabecera ? (
                  <p className="bg-surface-2 px-4 pb-1.5 pt-4 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-label-3">
                    {cabecera}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    vibrar();
                    onChange(o.valor);
                    cerrar();
                  }}
                  className="flex min-h-12 w-full items-center gap-3 border-b border-separator px-4 py-2.5 text-left transition last:border-0 active:bg-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "block truncate text-[1rem]",
                        sel ? "font-semibold text-accent" : "text-label",
                      )}
                    >
                      {o.label}
                    </span>
                    {o.detalle ? (
                      <span className="block truncate text-[0.84rem] text-label-3">
                        {o.detalle}
                      </span>
                    ) : null}
                  </span>
                  {sel ? (
                    <Check
                      className="h-5 w-5 shrink-0 text-accent"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
          {filtradas.length === 0 ? (
            <li className="px-4 py-6 text-center text-label-3">
              Sin resultados
            </li>
          ) : null}
        </ul>
      </Hoja>
    </Envoltura>
  );
}

/* ---------------- Fecha ---------------- */

function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

function hoyIso(): string {
  return sumarDias(new Date().toLocaleDateString("sv-SE"), 0);
}

function fechaLegible(iso: string): string {
  if (!iso) return "Sin fecha";
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  const hoy = hoyIso();
  const rel =
    iso === hoy
      ? "Hoy"
      : iso === sumarDias(hoy, -1)
        ? "Ayer"
        : iso === sumarDias(hoy, 1)
          ? "Mañana"
          : null;
  const texto = fecha.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return rel
    ? `${rel} · ${texto}`
    : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Fecha con flechas para día anterior / siguiente (lo más común en cocina) y el
 * selector nativo del sistema al tocar el centro. Valor en formato YYYY-MM-DD.
 */
export function Fecha(props: {
  valor: string;
  onChange: (iso: string) => void;
  label?: string;
  min?: string;
  max?: string;
}) {
  const { valor, onChange, label, min, max } = props;
  const id = useId();
  const puedeAtras = !min || !valor || sumarDias(valor, -1) >= min;
  const puedeAdelante = !max || !valor || sumarDias(valor, 1) <= max;
  return (
    <Envoltura id={id} label={label}>
      <div className="flex min-h-12 items-center rounded-control bg-fill">
        <button
          type="button"
          aria-label="Día anterior"
          disabled={!puedeAtras}
          onClick={() => {
            vibrar();
            onChange(sumarDias(valor || hoyIso(), -1));
          }}
          className="inline-flex size-12 shrink-0 items-center justify-center text-label-2 transition active:scale-90 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <label
          htmlFor={id}
          className="relative flex min-h-12 flex-1 cursor-pointer items-center justify-center"
        >
          <span className="text-[1rem] font-medium text-label">
            {fechaLegible(valor)}
          </span>
          <input
            id={id}
            type="date"
            value={valor}
            min={min}
            max={max}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <button
          type="button"
          aria-label="Día siguiente"
          disabled={!puedeAdelante}
          onClick={() => {
            vibrar();
            onChange(sumarDias(valor || hoyIso(), 1));
          }}
          className="inline-flex size-12 shrink-0 items-center justify-center text-label-2 transition active:scale-90 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </Envoltura>
  );
}

/* ---------------- Interruptor ---------------- */

export function Interruptor(props: {
  activo: boolean;
  onChange: (activo: boolean) => void;
  etiqueta: string;
}) {
  const { activo, onChange, etiqueta } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => {
        vibrar();
        onChange(!activo);
      }}
      className={cx(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200",
        activo ? "bg-success" : "bg-fill-strong",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute left-[2px] size-[27px] rounded-full bg-[#fff] shadow-[0_2px_6px_rgb(0_0_0/0.22)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          activo ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
