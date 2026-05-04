"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
  RUBRO_SECTION_BORDER,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

type Ingrediente = {
  id: string;
  nombre: string;
  disponible: boolean;
  rubro: RubroIngrediente;
};

type PlatoConIngredientes = {
  id: string;
  ingredientes_requeridos: string[] | null;
};

/** Todas las secciones arrancan plegadas; el usuario abre las que necesite. */
const RUBRO_EXPANDIDO_INICIAL: Record<RubroIngrediente, boolean> =
  RUBROS_INGREDIENTE.reduce(
    (acc, r) => {
      acc[r] = false;
      return acc;
    },
    {} as Record<RubroIngrediente, boolean>
  );

export default function InventarioPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [nuevoIngrediente, setNuevoIngrediente] = useState("");
  const [nuevoRubro, setNuevoRubro] = useState<RubroIngrediente>(
    "Despensa/Prep"
  );
  const [rubroExpandido, setRubroExpandido] =
    useState<Record<RubroIngrediente, boolean>>(RUBRO_EXPANDIDO_INICIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItems = useMemo(() => ingredientes.length > 0, [ingredientes.length]);

  const porRubro = useMemo(() => {
    const map = new Map<RubroIngrediente, Ingrediente[]>();
    RUBROS_INGREDIENTE.forEach((r) => map.set(r, []));
    ingredientes.forEach((item) => {
      const r = normalizarRubro(item.rubro);
      const list = map.get(r) ?? [];
      list.push({ ...item, rubro: r });
      map.set(r, list);
    });
    RUBROS_INGREDIENTE.forEach((r) => {
      map.get(r)?.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    return map;
  }, [ingredientes]);

  const cargarIngredientes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("ingredientes")
        .select("id, nombre, disponible, rubro")
        .order("nombre", { ascending: true });

      if (fetchError) {
        setError(formatPostgrestError(fetchError));
        return;
      }

      const rows = (data ?? []) as {
        id: string;
        nombre: string;
        disponible: boolean;
        rubro?: string | null;
      }[];

      setIngredientes(
        rows.map((row) => ({
          id: row.id,
          nombre: row.nombre,
          disponible: row.disponible,
          rubro: normalizarRubro(row.rubro),
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarIngredientes();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const actualizarDisponibilidad = async (id: string, disponible: boolean) => {
    const previous = ingredientes;

    setIngredientes((current) =>
      current.map((item) =>
        item.id === id ? { ...item, disponible } : item
      )
    );

    const { error: updateError } = await supabase
      .from("ingredientes")
      .update({ disponible })
      .eq("id", id);

    if (updateError) {
      setIngredientes(previous);
      setError(formatPostgrestError(updateError));
    }
  };

  const actualizarRubro = async (id: string, rubro: RubroIngrediente) => {
    const previous = ingredientes;
    setIngredientes((current) =>
      current.map((item) => (item.id === id ? { ...item, rubro } : item))
    );

    const { error: updateError } = await supabase
      .from("ingredientes")
      .update({ rubro })
      .eq("id", id);

    if (updateError) {
      setIngredientes(previous);
      setError(formatPostgrestError(updateError));
      return;
    }
    setRubroExpandido((prev) => ({ ...prev, [rubro]: true }));
  };

  const agregarIngrediente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombre = nuevoIngrediente.trim();

    if (!nombre) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("ingredientes")
      .insert({ nombre, disponible: true, rubro: nuevoRubro })
      .select("id, nombre, disponible, rubro")
      .single();

    if (insertError) {
      setError(formatPostgrestError(insertError));
      setIsSubmitting(false);
      return;
    }

    const row = data as {
      id: string;
      nombre: string;
      disponible: boolean;
      rubro?: string | null;
    };

    const rubroNuevo = normalizarRubro(row.rubro);
    setIngredientes((current) =>
      [
        ...current,
        {
          id: row.id,
          nombre: row.nombre,
          disponible: row.disponible,
          rubro: rubroNuevo,
        },
      ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    );
    setRubroExpandido((prev) => ({ ...prev, [rubroNuevo]: true }));
    setNuevoIngrediente("");
    setIsSubmitting(false);
  };

  const eliminarIngrediente = async (id: string) => {
    const previous = ingredientes;
    setError(null);
    setIngredientes((current) => current.filter((item) => item.id !== id));

    const { error: deleteError } = await supabase
      .from("ingredientes")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setIngredientes(previous);
      setError(formatPostgrestError(deleteError));
      return;
    }

    const { data: platosConIngrediente, error: fetchPlatosError } = await supabase
      .from("platos")
      .select("id, ingredientes_requeridos")
      .contains("ingredientes_requeridos", [id]);

    if (fetchPlatosError) {
      setError(
        `Ingrediente eliminado, pero no se pudo limpiar en platos: ${formatPostgrestError(
          fetchPlatosError
        )}`
      );
      return;
    }

    const platos = (platosConIngrediente ?? []) as PlatoConIngredientes[];
    if (platos.length === 0) {
      return;
    }

    const updates = await Promise.all(
      platos.map(async (plato) => {
        const nuevos = (plato.ingredientes_requeridos ?? []).filter(
          (ingredienteId) => ingredienteId !== id
        );
        const { error: updatePlatoError } = await supabase
          .from("platos")
          .update({ ingredientes_requeridos: nuevos })
          .eq("id", plato.id);
        return updatePlatoError;
      })
    );

    const primerError = updates.find((err) => err != null);
    if (primerError) {
      setError(
        `Ingrediente eliminado, pero algunos platos quedaron sin sincronizar: ${formatPostgrestError(
          primerError
        )}`
      );
    }
  };

  const selectRubroClass =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500";

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Ingredientes</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Disponibilidad y altas por rubro. Al entrar, las tres secciones vienen
            cerradas; tocá el título para abrir o cerrar cada una.
          </p>
        </header>

        <form
          onSubmit={agregarIngrediente}
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="nuevo-nombre"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Nombre
            </label>
            <input
              id="nuevo-nombre"
              value={nuevoIngrediente}
              onChange={(event) => setNuevoIngrediente(event.target.value)}
              placeholder="Agregar nuevo ingrediente"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <label
              htmlFor="nuevo-rubro"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Rubro
            </label>
            <select
              id="nuevo-rubro"
              value={nuevoRubro}
              onChange={(e) =>
                setNuevoRubro(normalizarRubro(e.target.value))
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {RUBROS_INGREDIENTE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2.5 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:mb-0.5"
            aria-label="Agregar ingrediente"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </form>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando ingredientes...
          </div>
        ) : !hasItems ? (
          <p className="text-sm text-zinc-500">
            No hay ingredientes todavía. Agregá el primero.
          </p>
        ) : (
          <div className="space-y-8">
            {RUBROS_INGREDIENTE.map((rubro) => {
              const lista = porRubro.get(rubro) ?? [];
              const expandido = rubroExpandido[rubro];
              const listId = `rubro-list-${rubro.replace(/\//g, "-")}`;

              const tituloRubro = (
                <>
                  {rubro}{" "}
                  <span className="font-normal text-zinc-500">
                    ({lista.length})
                  </span>
                </>
              );

              return (
                <section
                  key={rubro}
                  className={`rounded-xl border border-zinc-800 border-l-4 ${RUBRO_SECTION_BORDER[rubro]} bg-zinc-950/35 p-4`}
                >
                  <button
                    type="button"
                    id={`rubro-head-${rubro.replace(/\//g, "-")}`}
                    aria-expanded={expandido}
                    aria-controls={listId}
                    onClick={() =>
                      setRubroExpandido((prev) => ({
                        ...prev,
                        [rubro]: !prev[rubro],
                      }))
                    }
                    className="mb-3 flex w-full items-center gap-2 border-b border-zinc-800/80 pb-2 text-left text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300 transition hover:text-zinc-100"
                  >
                    <span className="inline-flex shrink-0 text-zinc-500" aria-hidden>
                      {expandido ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">{tituloRubro}</span>
                  </button>

                  <div id={listId}>
                    {expandido ? (
                      lista.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          Sin ítems en este rubro.
                        </p>
                      ) : (
                        <ul className="space-y-2" role="list">
                          {lista.map((ingrediente) => (
                            <li
                              key={ingrediente.id}
                              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0 text-sm text-zinc-100">
                                {ingrediente.nombre}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <label
                                  className="sr-only"
                                  htmlFor={`rubro-${ingrediente.id}`}
                                >
                                  Rubro de {ingrediente.nombre}
                                </label>
                                <select
                                  id={`rubro-${ingrediente.id}`}
                                  value={ingrediente.rubro}
                                  onChange={(e) =>
                                    void actualizarRubro(
                                      ingrediente.id,
                                      normalizarRubro(e.target.value)
                                    )
                                  }
                                  className={selectRubroClass}
                                >
                                  {RUBROS_INGREDIENTE.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={ingrediente.disponible}
                                  onClick={() =>
                                    void actualizarDisponibilidad(
                                      ingrediente.id,
                                      !ingrediente.disponible
                                    )
                                  }
                                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                    ingrediente.disponible
                                      ? "bg-zinc-100"
                                      : "bg-zinc-700"
                                  }`}
                                  aria-label={`Cambiar disponibilidad de ${ingrediente.nombre}`}
                                >
                                  <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 transition ${
                                      ingrediente.disponible
                                        ? "left-[22px]"
                                        : "left-0.5"
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void eliminarIngrediente(ingrediente.id)
                                  }
                                  className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
                                  aria-label={`Eliminar ${ingrediente.nombre}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : lista.length > 0 ? (
                      <p className="text-xs text-zinc-600">
                        {lista.length}{" "}
                        {lista.length === 1 ? "ítem oculto" : "ítems ocultos"}.
                        Tocá el título para ver la lista.
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
