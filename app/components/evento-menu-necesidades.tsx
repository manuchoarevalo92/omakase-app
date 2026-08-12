"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";

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
} {
  const conChecklist = plato.items.filter((i) => i.checklist);
  return {
    total: conChecklist.length,
    listos: conChecklist.filter((i) => i.checklist?.completado).length,
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
        menuItems.map((m) => m.platoId).filter((id): id is string => Boolean(id))
      ),
    ].sort();
    return ids.join(",");
  }, [menuItems]);

  useEffect(() => {
    const ids = platoIdsKey ? platoIdsKey.split(",") : [];
    if (ids.length === 0) {
      setNecesidades([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await fetchNecesidadesPorPlatos(ids);
        if (!cancelled) setNecesidades(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las necesidades por plato."
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
      (a, b) => a.orden - b.orden || a.platoNombre.localeCompare(b.platoNombre, "es")
    );

    for (const menu of menuOrdenado) {
      const dedupeKey = menu.platoId ?? `libre:${menu.platoNombre.toLowerCase()}`;
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

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Menú del evento
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tocá un plato para ver qué necesitás. El tilde sigue la checklist general.
        </p>
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {porSeccion.map((bloque) => (
            <section
              key={bloque.seccion}
              className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5"
            >
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {bloque.titulo}
              </h3>
              <ul className="mt-1.5 space-y-1">
                {bloque.platos.map((plato, index) => {
                  const abierto = abiertos.has(plato.key);
                  const prog = progresoPlato(plato);
                  return (
                    <li
                      key={plato.key}
                      className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/40"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAbierto(plato.key)}
                        aria-expanded={abierto}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-zinc-900/60"
                      >
                        {abierto ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                        )}
                        <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-500">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-zinc-100">
                          {plato.nombre}
                        </span>
                        {prog.total > 0 ? (
                          <span
                            className={`shrink-0 text-[10px] tabular-nums ${
                              prog.listos === prog.total
                                ? "text-emerald-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {prog.listos}/{prog.total}
                          </span>
                        ) : null}
                      </button>

                      {abierto ? (
                        <div className="border-t border-zinc-800/80 px-3 py-2">
                          {plato.items.length === 0 ? (
                            <p className="text-xs text-zinc-500">
                              {plato.platoId
                                ? "Sin necesidades cargadas para este plato."
                                : "Ítem libre — sin ficha de necesidades."}
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {plato.items.map((fila) => {
                                const check = fila.checklist;
                                const listo = check?.completado === true;
                                const contenido = (
                                  <>
                                    {check ? (
                                      listo ? (
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                      ) : (
                                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                                      )
                                    ) : (
                                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/70" />
                                    )}
                                    <span
                                      className={`min-w-0 flex-1 text-sm ${
                                        listo
                                          ? "text-zinc-500 line-through"
                                          : "text-zinc-200"
                                      }`}
                                    >
                                      {fila.item}
                                    </span>
                                    {check ? (
                                      <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                                        {check.cantidad} {check.unidad}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 text-[10px] text-amber-500/90">
                                        No en checklist
                                      </span>
                                    )}
                                  </>
                                );

                                if (check && onToggleChecklistItem) {
                                  return (
                                    <li key={`${plato.key}-${fila.item}`}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggleChecklistItem(check.id)
                                        }
                                        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-zinc-900/70"
                                      >
                                        {contenido}
                                      </button>
                                    </li>
                                  );
                                }

                                return (
                                  <li
                                    key={`${plato.key}-${fila.item}`}
                                    className="flex items-start gap-2 px-1.5 py-1.5"
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
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
