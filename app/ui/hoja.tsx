"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "./haptica";

let bloqueos = 0;

/** Hojas abiertas, de abajo hacia arriba: Escape cierra solo la de arriba. */
const pilaHojas: string[] = [];

const sinSuscripcion = () => () => {};

/** true solo en el cliente, ya hidratado (para usar portales sin desajustes). */
export function useMontado(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
}

/** Bloquea el scroll del fondo mientras haya alguna hoja abierta (cuenta anidadas). */
function useBloquearScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    bloqueos += 1;
    const html = document.documentElement;
    const previo = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      bloqueos -= 1;
      if (bloqueos === 0) html.style.overflow = previo;
    };
  }, [activo]);
}

/**
 * Hoja que sube desde abajo (en pantallas anchas, un diálogo centrado).
 * Se cierra con el fondo, con Escape, con la X o arrastrando la manija hacia abajo.
 */
export function Hoja(props: {
  abierta: boolean;
  onCerrar: () => void;
  titulo?: ReactNode;
  /** Botón a la derecha del título (p. ej. "Listo"). */
  accion?: ReactNode;
  /** "auto" se ajusta al contenido; "alta" ocupa casi toda la pantalla. */
  alto?: "auto" | "alta";
  children: ReactNode;
}) {
  const { abierta, onCerrar, titulo, accion, alto = "auto", children } = props;
  const montado = useMontado();
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  useBloquearScroll(abierta);

  // useEffectEvent: el efecto depende solo de `abierta`. Si dependiera de
  // onCerrar (una función nueva en cada render), al tipear dentro de la hoja se
  // volvía a enfocar el panel y el campo perdía el foco.
  const alEscape = useEffectEvent(() => onCerrar());

  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    // Respeta un campo con autoFocus dentro de la hoja.
    if (!panel.current?.contains(document.activeElement)) {
      panel.current?.focus({ preventScroll: true });
    }
    pilaHojas.push(idTitulo);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pilaHojas[pilaHojas.length - 1] === idTitulo) {
        alEscape();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      const i = pilaHojas.lastIndexOf(idTitulo);
      if (i >= 0) pilaHojas.splice(i, 1);
      window.removeEventListener("keydown", onKey);
      previo?.focus?.({ preventScroll: true });
    };
  }, [abierta, idTitulo]);

  if (!montado || !abierta) return null;

  const soltar = () => {
    if (arrastre > 90) onCerrar();
    inicio.current = null;
    setArrastre(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onCerrar}
        className="ui-fondo-entra absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        tabIndex={-1}
        style={{
          transform: arrastre ? `translateY(${arrastre}px)` : undefined,
          boxShadow: "var(--sombra-hoja)",
        }}
        className={cx(
          "ui-hoja-entra relative flex w-full flex-col overflow-hidden rounded-t-[1.4rem] bg-surface-2 text-label outline-none sm:max-w-lg sm:rounded-[1.4rem]",
          alto === "alta"
            ? "h-[92dvh] sm:h-[80vh]"
            : "max-h-[92dvh] sm:max-h-[85vh]",
          arrastre ? "" : "transition-transform duration-200",
        )}
      >
        <div
          className="flex touch-none justify-center pb-1 pt-2.5 sm:hidden"
          onPointerDown={(e) => {
            inicio.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (inicio.current !== null)
              setArrastre(Math.max(0, e.clientY - inicio.current));
          }}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <span
            className="h-[5px] w-9 rounded-full bg-fill-strong"
            aria-hidden
          />
        </div>
        {titulo || accion ? (
          <div className="flex min-h-12 items-center gap-2 px-4 pb-2 sm:pt-3">
            <h2
              id={idTitulo}
              className="min-w-0 flex-1 truncate text-[1.06rem] font-semibold"
            >
              {titulo}
            </h2>
            {accion ?? (
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="inline-flex size-9 items-center justify-center rounded-full bg-fill text-label-2 transition active:scale-95"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
