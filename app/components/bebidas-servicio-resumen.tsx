import type { BebidaAsientoResumen } from "@/src/lib/bebidas-asientos";

type Props = {
  asientos: BebidaAsientoResumen[];
};

export function BebidasServicioResumen({ asientos }: Props) {
  if (asientos.length === 0) {
    return <p className="text-xs italic text-zinc-600">Sin bebidas registradas</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {asientos.map(({ asiento, lineas }) => (
        <section
          key={asiento}
          className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5"
        >
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Asiento {asiento}
          </h3>
          <ul className="mt-1.5 space-y-0.5 text-[13px] leading-snug text-zinc-100">
            {lineas.map((linea, index) => (
              <li key={`${asiento}-${index}-${linea.bebida}`} className="flex gap-1.5">
                <span className="min-w-0 flex-1">{linea.bebida || "—"}</span>
                {linea.cantidad ? (
                  <span className="shrink-0 tabular-nums text-zinc-500">{linea.cantidad}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
