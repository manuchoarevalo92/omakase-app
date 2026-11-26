import type { BebidaAsientoResumen } from "@/src/lib/bebidas-asientos";

type Props = {
  asientos: BebidaAsientoResumen[];
};

/** Bebidas por asiento de un servicio, de solo lectura (Historial). */
export function BebidasServicioResumen({ asientos }: Props) {
  if (asientos.length === 0) {
    return (
      <p className="rounded-card bg-surface-3 px-4 py-3 text-[0.94rem] text-label-3">
        Sin bebidas registradas
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {asientos.map(({ asiento, lineas }) => (
        <section
          key={asiento}
          className="rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
        >
          <h4 className="text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
            Asiento {asiento}
          </h4>
          <ul className="mt-1.5 space-y-1 text-[0.97rem] leading-snug text-label">
            {lineas.map((linea, index) => (
              <li
                key={`${asiento}-${index}-${linea.bebida}`}
                className="flex gap-2"
              >
                <span className="min-w-0 flex-1 break-words">
                  {linea.bebida || (linea.formato === "Extra" ? "Extra" : "—")}
                </span>
                {linea.cantidad || linea.formato ? (
                  <span className="shrink-0 text-label-2">
                    {linea.cantidad ? (
                      <span className="font-mono tabular-nums">
                        {linea.cantidad}
                      </span>
                    ) : null}
                    {linea.cantidad && linea.formato ? " · " : null}
                    {linea.formato ? (
                      <span className="text-[0.88rem]">{linea.formato}</span>
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
