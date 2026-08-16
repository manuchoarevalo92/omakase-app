"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  viewerName: string;
  children: ReactNode;
};

/** Evita copiar/pegar y marca la receta con el nombre de quien la mira.
 * Un screenshot del sistema o una foto del teléfono no se pueden bloquear:
 * la marca de agua sirve para saber de quién salió. */
export function RecetaProtegida({ viewerName, children }: Props) {
  const [oculta, setOculta] = useState(false);
  const marca = `${viewerName} · uso interno`;

  useEffect(() => {
    const onVis = () => setOculta(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const bloquear = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <div
      className="relative select-none overflow-hidden"
      onCopy={bloquear}
      onCut={bloquear}
      onContextMenu={bloquear}
      onDragStart={bloquear}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <div
        className={`transition-all duration-150 ${oculta ? "blur-lg" : ""}`}
        aria-hidden={oculta}
      >
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.14]"
        aria-hidden
      >
        <div className="absolute -left-8 top-0 flex h-[220%] w-[160%] origin-top-left -rotate-12 flex-col gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <p
              key={i}
              className="whitespace-nowrap text-sm font-semibold tracking-widest text-zinc-100"
            >
              {`${marca}    ${marca}    ${marca}`}
            </p>
          ))}
        </div>
      </div>
      {oculta ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-xs text-zinc-400">
          Receta oculta
        </div>
      ) : null}
    </div>
  );
}
