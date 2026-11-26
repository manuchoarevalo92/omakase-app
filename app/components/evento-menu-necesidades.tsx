"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Circle, CircleAlert, CircleCheck } from "lucide-react";

import { EsqueletoLista, Seccion, cx, vibrar } from "@/app/ui";
import {
  ETIQUETA_EVENTO_SECCION,
  EVENTO_MENU_SECCIONES,
  type EventoChecklistItem,
  type EventoMenuItem,
  type EventoMenuSeccion,
} from "@/src/lib/eventos";
import {
  fetchNecesidadesPorPlatos,
  type PlatoNecesidad,
} from "@/src/lib/plato-necesidades";

type Props = {
  menuItems: EventoMenuItem[];
  checklistItems: EventoChecklistItem[];
  onToggleChecklistItem?: (itemId: string) => void;
};

type PlatoConNecesidades = {
  key: string;
  platoId: string | null;
  nombre: string;
  seccion: EventoMenuSeccion | null;
  orden: number;
  items: {
    item: string;
    checklist: EventoChecklistItem | null;
  }[];
};

function claveTitulo(titulo: string): string {
  return titulo.trim().toLowerCase();
}

function progresoPlato(plato: PlatoConNecesidades): {
  total: number;
  listos: number;
  enValija: number;
} {
  const conChecklist = plato.items.filter((i) => i.checklist);
  return {
    total: conChecklist.length,
    listos: conChecklist.filter((i) => i.checklist?.completado).length,
    enValija: conChecklist.filter((i) => i.checklist?.enValija).length,
  };
}

export function EventoMenuNecesidades({
  menuItems,
  checklistItems,
  onToggleChecklistItem,
}: Props) {
  const [necesidades, setNecesidades] = useState<PlatoNecesidad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());

  const platoIdsKey = useMemo(() => {
    const ids = [
      ...new Set(
        menuItems
          .map((m) => m.platoId)
          .filter((id): id is string => Boolean(id)),
      ),
    ].sort();
    return ids.join(",");
  }, [menuItems]);

  useEffect(() => {
    const ids = platoIdsKey ? platoIdsKey.split(",") : [];
    let cancelled = false;

    void (async () => {
      if (ids.length === 0) {
        setNecesidades([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchNecesidadesPorPlatos(ids);
        if (!cancelled) setNecesidades(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las necesidades por plato.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platoIdsKey]);

  const checklistPorTitulo = useMemo(() => {
    const map = new Map<string, EventoChecklistItem>();
    for (const c of checklistItems) {
      map.set(claveTitulo(c.titulo), c);
    }
    return map;
  }, [checklistItems]);

  const platos = useMemo((): PlatoConNecesidades[] => {
    const porPlatoId = new Map<string, PlatoNecesidad[]>();
    for (const n of necesidades) {
      const lista = porPlatoId.get(n.platoId) ?? [];
      lista.push(n);
      porPlatoId.set(n.platoId, lista);
    }

    const vistos = new Set<string>();
    const resultado: PlatoConNecesidades[] = [];
    const menuOrdenado = [...menuItems].sort(
      (a, b) =>
        a.orden - b.orden || a.platoNombre.localeCompare(b.platoNombre, "es"),
    );

    for (const menu of menuOrdenado) {
      const dedupeKey =
        menu.platoId ?? `libre:${menu.platoNombre.toLowerCase()}`;
      if (vistos.has(dedupeKey)) continue;
      vistos.add(dedupeKey);

      const itemsNec =
        menu.platoId && porPlatoId.has(menu.platoId)
          ? (porPlatoId.get(menu.platoId) ?? []).map((n) => ({
              item: n.item,
              checklist: checklistPorTitulo.get(claveTitulo(n.item)) ?? null,
            }))
          : [];

      resultado.push({
        key: dedupeKey,
        platoId: menu.platoId,
        nombre: menu.platoNombre,
        seccion: menu.seccion,
        orden: menu.orden,
        items: itemsNec,
      });
    }

    return resultado;
  }, [menuItems, necesidades, checklistPorTitulo]);

  const porSeccion = useMemo(() => {
    const map = new Map<EventoMenuSeccion | "sin", PlatoConNecesidades[]>();
    for (const seccion of EVENTO_MENU_SECCIONES) {
      map.set(seccion, []);
    }
    map.set("sin", []);

    for (const plato of platos) {
      const key = plato.seccion ?? "sin";
      const lista = map.get(key) ?? [];
      lista.push(plato);
      map.set(key, lista);
    }

    return EVENTO_MENU_SECCIONES.map((seccion) => ({
      seccion,
      titulo: ETIQUETA_EVENTO_SECCION[seccion],
      platos: map.get(seccion) ?? [],
    })).filter((bloque) => bloque.platos.length > 0);
  }, [platos]);

  const toggleAbierto = (key: string) => {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (menuItems.length === 0) return null;

  if (loading) {
    return (
      <div className="mt-6">
        <EsqueletoLista filas={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-6 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
      >
        <CircleAlert
          className="mt-0.5 h-[18px] w-[18px] shrink-0"
          aria-hidden
        />
        <p className="min-w-0 flex-1">{error}</p>
      </div>
    );
  }

  return (
    <>
      {porSeccion.map((bloque) => (
        <Seccion key={bloque.seccion} titulo={bloque.titulo}>
          <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            {bloque.platos.map((plato, index) => {
              const abierto = abiertos.has(plato.key);
              const prog = progresoPlato(plato);
              return (
                <li
                  key={plato.key}
                  className="border-b border-separator last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      vibrar();
                      toggleAbierto(plato.key);
                    }}
                    aria-expanded={abierto}
                    className="flex min-h-14 w-full items-center gap-3 py-2 pl-4 pr-3 text-left transition active:bg-fill"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill font-mono text-[0.8rem] tabular-nums text-label-2">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[1rem] leading-snug text-label">
                      {plato.nombre}
                    </span>
                    {prog.total > 0 ? (
                      <span className="shrink-0 text-right text-[0.8rem] leading-tight tabular-nums text-label-3">
                        <span
                          className={cx(
                            "block",
                            prog.listos === prog.total && "text-info",
                          )}
                        >
                          {prog.listos}/{prog.total} listos
                        </span>
                        <span
                          className={cx(
                            "block",
                            prog.enValija === prog.total &&
                              "font-semibold text-success",
                          )}
                        >
                          {prog.enValija}/{prog.total} valija
                        </span>
                      </span>
                    ) : null}
                    <ChevronRight
                      className={cx(
                        "h-[18px] w-[18px] shrink-0 text-label-3 transition-transform",
                        abierto && "rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>

                  {abierto ? (
                    <div className="border-t border-separator bg-surface-2">
                      {plato.items.length === 0 ? (
                        <p className="px-4 py-3 text-[0.9rem] text-label-3">
                          {plato.platoId
                            ? "Sin necesidades cargadas para este plato."
                            : "Ítem libre: no tiene ficha de necesidades."}
                        </p>
                      ) : (
                        <ul>
                          {plato.items.map((fila) => {
                            const check = fila.checklist;
                            const listo = check?.completado === true;
                            const enValija = check?.enValija === true;
                            const contenido = (
                              <>
                                {check ? (
                                  listo ? (
                                    <CircleCheck
                                      className="h-5 w-5 shrink-0 text-info"
                                      aria-hidden
                                    />
                                  ) : (
                                    <Circle
                                      className="h-5 w-5 shrink-0 text-label-3"
                                      aria-hidden
                                    />
                                  )
                                ) : (
                                  <Circle
                                    className="h-5 w-5 shrink-0 text-warning"
                                    aria-hidden
                                  />
                                )}
                                <span
                                  className={cx(
                                    "min-w-0 flex-1 text-[0.97rem] leading-snug",
                                    enValija
                                      ? "text-label-3 line-through"
                                      : "text-label",
                                  )}
                                >
                                  {fila.item}
                                </span>
                                {check ? (
                                  <span className="shrink-0 text-right text-[0.84rem] tabular-nums text-label-3">
                                    {check.cantidad} {check.unidad}
                                    {enValija ? (
                                      <span className="block font-semibold text-success">
                                        En valija
                                      </span>
                                    ) : listo ? (
                                      <span className="block text-info">
                                        Listo
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[0.8rem] text-warning">
                                    No está en la checklist
                                  </span>
                                )}
                              </>
                            );

                            if (check && onToggleChecklistItem) {
                              return (
                                <li
                                  key={`${plato.key}-${fila.item}`}
                                  className="border-b border-separator last:border-0"
                                >
                                  <button
                                    type="button"
                                    aria-pressed={listo}
                                    aria-label={`${fila.item}: ${listo ? "marcar no listo" : "marcar listo"}`}
                                    onClick={() => {
                                      vibrar(listo ? "toque" : "exito");
                                      onToggleChecklistItem(check.id);
                                    }}
                                    className="flex min-h-12 w-full items-center gap-3 py-2 pl-4 pr-3 text-left transition active:bg-fill"
                                  >
                                    {contenido}
                                  </button>
                                </li>
                              );
                            }

                            return (
                              <li
                                key={`${plato.key}-${fila.item}`}
                                className="flex min-h-12 items-center gap-3 border-b border-separator py-2 pl-4 pr-3 last:border-0"
                              >
                                {contenido}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Seccion>
      ))}
    </>
  );
}
