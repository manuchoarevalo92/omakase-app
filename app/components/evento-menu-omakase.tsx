"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

import {
  contarPasosMenu,
  EVENTO_NIGIRI_BASE,
  EVENTO_OTSUMAMI_REGALO,
  type EventoMenuItem,
  type EventoMenuOmakaseSlots,
} from "@/src/lib/eventos";

type PlatoCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
};

type Props = {
  slots: EventoMenuOmakaseSlots;
  onSlotsChange: (next: EventoMenuOmakaseSlots) => void;
  platos: PlatoCatalogo[];
  extras: EventoMenuItem[];
  isSaving: boolean;
  onGuardarMenu: () => void;
  onAgregarExtra: (platoId: string) => void;
  onAgregarLibre: (nombre: string) => void;
  onQuitarExtra: (item: EventoMenuItem) => void;
  extraPlatoId: string;
  onExtraPlatoIdChange: (id: string) => void;
  extraLibre: string;
  onExtraLibreChange: (v: string) => void;
};

function esDuplicado(lista: string[], index: number, platoId: string): boolean {
  return lista.some((id, i) => i !== index && id === platoId && platoId.length > 0);
}

export function EventoMenuOmakase(props: Props) {
  const {
    slots,
    onSlotsChange,
    platos,
    extras,
    isSaving,
    onGuardarMenu,
    onAgregarExtra,
    onAgregarLibre,
    onQuitarExtra,
    extraPlatoId,
    onExtraPlatoIdChange,
    extraLibre,
    onExtraLibreChange,
  } = props;

  const opciones = useMemo(() => {
    const map = new Map<string, PlatoCatalogo[]>();
    for (const p of platos) {
      const lista = map.get(p.categoria) ?? [];
      lista.push(p);
      map.set(p.categoria, lista);
    }
    return map;
  }, [platos]);

  const conteo = contarPasosMenu(slots);

  const setPaso = (
    seccion: "otsumami" | "regalo" | "nigiri" | "postre",
    index: number,
    valor: string
  ) => {
    const lista = [...slots[seccion]];
    lista[index] = valor;
    onSlotsChange({ ...slots, [seccion]: lista });
  };

  const intercambiarNigiri = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= EVENTO_NIGIRI_BASE || j >= EVENTO_NIGIRI_BASE) return;
    const lista = [...slots.nigiri];
    const tmp = lista[i];
    lista[i] = lista[j];
    lista[j] = tmp;
    onSlotsChange({ ...slots, nigiri: lista });
  };

  const selectClass =
    "w-full border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Menú Omakase
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Base {conteo.base}/{conteo.baseObjetivo}
            {!slots.nigiriOnly
              ? ` · Regalo ${conteo.regalo}/${EVENTO_OTSUMAMI_REGALO}`
              : ""}
            . Después armamos la checklist con lo que hace falta por plato.
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={slots.nigiriOnly}
            onChange={(e) =>
              onSlotsChange({ ...slots, nigiriOnly: e.target.checked })
            }
            className="h-3.5 w-3.5 border-zinc-600 bg-zinc-950"
          />
          Nigiri only
        </label>
      </div>

      {platos.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay platos en el catálogo.</p>
      ) : (
        <div className="space-y-5">
          {!slots.nigiriOnly ? (
            <>
              <div>
                <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Otsumami (4 base)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {slots.otsumami.map((valor, index) => (
                    <div
                      key={`otsu-${index}`}
                      className="border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                    >
                      <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                        Otsumami {index + 1}
                      </label>
                      <select
                        value={valor}
                        onChange={(e) => setPaso("otsumami", index, e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Seleccionar…</option>
                        {(opciones.get("Otsumami") ?? []).map((plato) => (
                          <option
                            key={plato.id}
                            value={plato.id}
                            disabled={esDuplicado(slots.otsumami, index, plato.id)}
                          >
                            {plato.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Otsumami regalo (opcionales)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {slots.regalo.map((valor, index) => (
                    <div
                      key={`regalo-${index}`}
                      className="border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                    >
                      <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                        Regalo {index + 1}
                      </label>
                      <select
                        value={valor}
                        onChange={(e) => setPaso("regalo", index, e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Sin regalo</option>
                        {(opciones.get("Otsumami") ?? []).map((plato) => (
                          <option
                            key={plato.id}
                            value={plato.id}
                            disabled={esDuplicado(slots.regalo, index, plato.id)}
                          >
                            {plato.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              Nigiri (12) · orden con flechas
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.nigiri.map((valor, index) => (
                <div
                  key={`nigiri-${index}`}
                  className="flex gap-2 border border-zinc-800 bg-zinc-900/60 px-2 py-2 sm:px-3"
                >
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Nigiri {index + 1}
                    </label>
                    <select
                      value={valor}
                      onChange={(e) => setPaso("nigiri", index, e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Seleccionar…</option>
                      {(opciones.get("Nigiri") ?? []).map((plato) => (
                        <option
                          key={plato.id}
                          value={plato.id}
                          disabled={esDuplicado(slots.nigiri, index, plato.id)}
                        >
                          {plato.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-zinc-800/80 pl-1.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => intercambiarNigiri(index, index - 1)}
                      className="inline-flex size-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-400 disabled:opacity-30"
                      aria-label={`Subir Nigiri ${index + 1}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index >= EVENTO_NIGIRI_BASE - 1}
                      onClick={() => intercambiarNigiri(index, index + 1)}
                      className="inline-flex size-8 items-center justify-center border border-zinc-700 bg-zinc-950 text-zinc-400 disabled:opacity-30"
                      aria-label={`Bajar Nigiri ${index + 1}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!slots.nigiriOnly ? (
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                Postre (1)
              </h3>
              {slots.postre.map((valor, index) => (
                <div
                  key={`postre-${index}`}
                  className="max-w-md border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                >
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Postre
                  </label>
                  <select
                    value={valor}
                    onChange={(e) => setPaso("postre", index, e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Seleccionar…</option>
                    {(opciones.get("Postre") ?? []).map((plato) => (
                      <option key={plato.id} value={plato.id}>
                        {plato.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onGuardarMenu}
            disabled={isSaving || conteo.base === 0}
            className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-[0.7rem] tracking-[0.18em] text-paper transition hover:bg-seal disabled:opacity-40"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            GUARDAR MENÚ
          </button>

          <div className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              Extras (opcionales)
            </h3>
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                value={extraPlatoId}
                onChange={(e) => onExtraPlatoIdChange(e.target.value)}
                className={`min-w-[10rem] flex-1 ${selectClass}`}
              >
                <option value="">Plato extra…</option>
                {platos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.categoria} · {p.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onAgregarExtra(extraPlatoId)}
                disabled={isSaving || !extraPlatoId}
                className="inline-flex items-center gap-1 border border-zinc-600 px-3 py-2 text-sm disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                value={extraLibre}
                onChange={(e) => onExtraLibreChange(e.target.value)}
                placeholder="Ítem libre (ej. Sake premium)"
                className={`min-w-[12rem] flex-1 ${selectClass}`}
              />
              <button
                type="button"
                onClick={() => onAgregarLibre(extraLibre)}
                disabled={isSaving || !extraLibre.trim()}
                className="border border-zinc-600 px-3 py-2 text-sm disabled:opacity-40"
              >
                Agregar libre
              </button>
            </div>
            {extras.length > 0 ? (
              <ul className="divide-y divide-zinc-800 border border-zinc-800">
                {extras.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="text-sm text-zinc-100">{item.platoNombre}</span>
                    <button
                      type="button"
                      onClick={() => onQuitarExtra(item)}
                      className="p-1.5 text-zinc-500 hover:text-red-400"
                      aria-label={`Quitar ${item.platoNombre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
