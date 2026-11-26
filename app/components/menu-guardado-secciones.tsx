type Props = {
  otsumami: string[];
  nigiri: string[];
  postre: string[];
  regalo: string[];
  extensiones: string[];
  nombrePlato: (id: string) => string;
};

type Bloque = {
  titulo: string;
  ids: string[];
  numerar: boolean;
  /** Nigiri y extensiones: dos columnas en pantallas anchas. */
  columnas?: boolean;
};

/** Menú servido, de solo lectura (Omakase e Historial). */
export function MenuGuardadoSecciones({
  otsumami,
  nigiri,
  postre,
  regalo,
  extensiones,
  nombrePlato,
}: Props) {
  const bloques: Bloque[] = [
    { titulo: "Otsumami", ids: otsumami, numerar: true },
    { titulo: "Nigiri", ids: nigiri, numerar: true, columnas: true },
    { titulo: "Postre", ids: postre, numerar: false },
    { titulo: "Regalos", ids: regalo, numerar: true },
    { titulo: "Extensiones", ids: extensiones, numerar: true, columnas: true },
  ].filter((b) => b.ids.length > 0 || b.titulo === "Nigiri");

  return (
    <div className="space-y-5">
      {bloques.map((bloque) => (
        <section key={bloque.titulo}>
          <h3 className="mb-2 flex items-baseline justify-between px-1 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
            {bloque.titulo}
            <span className="font-mono text-[0.75rem] font-normal normal-case tracking-normal tabular-nums">
              {bloque.ids.length}
            </span>
          </h3>
          {bloque.ids.length === 0 ? (
            <p className="rounded-card bg-surface-3 px-4 py-3 text-[0.94rem] text-label-3">
              Sin ítems
            </p>
          ) : (
            <ol
              className={`overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${
                bloque.columnas ? "sm:grid sm:grid-flow-col sm:grid-cols-2" : ""
              }`}
              style={
                bloque.columnas
                  ? {
                      gridTemplateRows: `repeat(${Math.ceil(bloque.ids.length / 2)}, auto)`,
                    }
                  : undefined
              }
            >
              {bloque.ids.map((id, i) => (
                <li
                  key={`${bloque.titulo}-${id}-${i}`}
                  className="flex min-h-12 items-center gap-3 border-b border-separator px-4 py-2.5 last:border-0"
                >
                  {bloque.numerar ? (
                    <span className="w-5 shrink-0 text-right font-mono text-[0.8rem] tabular-nums text-label-3">
                      {i + 1}
                    </span>
                  ) : null}
                  <span className="min-w-0 break-words text-[1rem] leading-snug text-label">
                    {nombrePlato(id)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
