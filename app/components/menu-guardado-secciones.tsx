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
  /** Nigiri: más denso en dos columnas en pantallas anchas */
  columnas?: boolean;
};

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
  ];

  return (
    <div className="space-y-2.5">
      {bloques.map((bloque) => (
        <section
          key={bloque.titulo}
          className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5"
        >
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {bloque.titulo}
          </h3>
          {bloque.ids.length === 0 ? (
            <p className="mt-1.5 text-xs italic text-zinc-600">Sin ítems</p>
          ) : (
            <ul
              className={
                bloque.columnas
                  ? "mt-1.5 columns-1 gap-x-3 sm:columns-2 sm:text-[12px]"
                  : "mt-1.5 space-y-0.5 text-[13px] leading-snug"
              }
            >
              {bloque.ids.map((id, i) => (
                <li
                  key={`${bloque.titulo}-${id}-${i}`}
                  className={
                    bloque.columnas
                      ? "mb-0.5 flex break-inside-avoid gap-1.5 pr-1 leading-snug text-zinc-100"
                      : bloque.numerar
                        ? "flex gap-1.5 text-zinc-100"
                        : "text-zinc-100"
                  }
                >
                  {bloque.numerar ? (
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums">
                      {i + 1}
                    </span>
                  ) : null}
                  <span className="min-w-0 break-words">{nombrePlato(id)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
