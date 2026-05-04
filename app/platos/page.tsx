"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/src/lib/supabase";

type Categoria = "Otsumami" | "Nigiri" | "Postre" | "Extensión";

type Ingrediente = {
  id: string;
  nombre: string;
  disponible: boolean;
  rubro?: string | null;
};

type Plato = {
  id: string;
  nombre: string;
  categoria: Categoria;
  ingredientes_requeridos: string[] | null;
};

const CATEGORIAS: Categoria[] = ["Otsumami", "Nigiri", "Postre", "Extensión"];

export default function PlatosPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("Otsumami");
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<
    string[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPlatoId, setEditingPlatoId] = useState<string | null>(null);
  const [confirmDeletePlato, setConfirmDeletePlato] = useState<Plato | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ingredienteQuery, setIngredienteQuery] = useState("");
  const [isIngredienteDropdownOpen, setIsIngredienteDropdownOpen] = useState(false);
  const [ingredientesBorrador, setIngredientesBorrador] = useState<string[]>([]);
  const [isUpdatingIngredientes, setIsUpdatingIngredientes] = useState(false);
  const [isAddingIngrediente, setIsAddingIngrediente] = useState(false);

  const ingredientesPorId = useMemo(() => {
    return new Map(ingredientes.map((item) => [item.id, item]));
  }, [ingredientes]);

  const ingredientesOrdenados = useMemo(() => {
    return [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ingredientes]);

  const ingredientesFiltrados = useMemo(() => {
    const query = ingredienteQuery.trim().toLowerCase();
    if (!query) {
      return ingredientesOrdenados;
    }

    return ingredientesOrdenados.filter((ingrediente) =>
      ingrediente.nombre.toLowerCase().includes(query)
    );
  }, [ingredientesOrdenados, ingredienteQuery]);

  const ingredienteYaExiste = useMemo(() => {
    const query = ingredienteQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return ingredientesOrdenados.some(
      (ingrediente) => ingrediente.nombre.trim().toLowerCase() === query
    );
  }, [ingredienteQuery, ingredientesOrdenados]);

  const platosPorCategoria = useMemo(() => {
    return CATEGORIAS.map((nombreCategoria) => ({
      categoria: nombreCategoria,
      platos: platos
        .filter((plato) => plato.categoria === nombreCategoria)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }));
  }, [platos]);

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ingredientesResponse, platosResponse] = await Promise.all([
        supabase
          .from("ingredientes")
          .select("id, nombre, disponible, rubro")
          .order("nombre", { ascending: true }),
        supabase
          .from("platos")
          .select("id, nombre, categoria, ingredientes_requeridos")
          .order("nombre", { ascending: true }),
      ]);

      if (ingredientesResponse.error) {
        setError(ingredientesResponse.error.message);
        return;
      }

      if (platosResponse.error) {
        setError(platosResponse.error.message);
        return;
      }

      setIngredientes((ingredientesResponse.data as Ingrediente[]) ?? []);
      setPlatos((platosResponse.data as Plato[]) ?? []);
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
      void cargarDatos();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const toggleIngredienteBorrador = (ingredienteId: string) => {
    setIngredientesBorrador((actual) =>
      actual.includes(ingredienteId)
        ? actual.filter((id) => id !== ingredienteId)
        : [...actual, ingredienteId]
    );
  };

  const abrirSelectorIngredientes = () => {
    setIngredientesBorrador(ingredientesSeleccionados);
    setIngredienteQuery("");
    setIsIngredienteDropdownOpen(true);
  };

  const cancelarSelectorIngredientes = () => {
    setIngredientesBorrador(ingredientesSeleccionados);
    setIngredienteQuery("");
    setIsIngredienteDropdownOpen(false);
  };

  const confirmarSelectorIngredientes = async () => {
    if (!editingPlatoId) {
      return;
    }

    setIsUpdatingIngredientes(true);
    setError(null);

    const { data, error: updateError } = await supabase
      .from("platos")
      .update({ ingredientes_requeridos: ingredientesBorrador })
      .eq("id", editingPlatoId)
      .select("id, nombre, categoria, ingredientes_requeridos")
      .single();

    if (updateError) {
      setError(updateError.message);
      setIsUpdatingIngredientes(false);
      return;
    }

    setPlatos((actual) =>
      actual.map((plato) => (plato.id === editingPlatoId ? (data as Plato) : plato))
    );
    setIngredientesSeleccionados(ingredientesBorrador);
    setIsIngredienteDropdownOpen(false);
    setIsUpdatingIngredientes(false);
  };

  const agregarIngredienteDesdeDropdown = async () => {
    const nombre = ingredienteQuery.trim();
    if (!nombre || ingredienteYaExiste) {
      return;
    }

    setIsAddingIngrediente(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("ingredientes")
      .insert({ nombre, disponible: true, rubro: "Despensa/Prep" })
      .select("id, nombre, disponible, rubro")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsAddingIngrediente(false);
      return;
    }

    const nuevoIngrediente = data as Ingrediente;
    setIngredientes((actual) => [...actual, nuevoIngrediente]);
    setIngredientesBorrador((actual) =>
      actual.includes(nuevoIngrediente.id)
        ? actual
        : [...actual, nuevoIngrediente.id]
    );
    setIngredienteQuery("");
    setIsAddingIngrediente(false);
  };

  const iniciarEdicion = (plato: Plato) => {
    if (editingPlatoId === plato.id) {
      setEditingPlatoId(null);
      setIngredientesSeleccionados([]);
      setIngredientesBorrador([]);
      setIngredienteQuery("");
      setIsIngredienteDropdownOpen(false);
      return;
    }

    setIngredientesSeleccionados(plato.ingredientes_requeridos ?? []);
    setIngredientesBorrador(plato.ingredientes_requeridos ?? []);
    setEditingPlatoId(plato.id);
    setIngredienteQuery("");
    setIsIngredienteDropdownOpen(false);
    setError(null);
  };

  const guardarPlato = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      nombre: nombreLimpio,
      categoria,
      ingredientes_requeridos: [] as string[],
    };

    const { data, error: insertError } = await supabase
      .from("platos")
      .insert(payload)
      .select("id, nombre, categoria, ingredientes_requeridos")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSaving(false);
      return;
    }

    const nuevoPlato = data as Plato;
    setPlatos((actual) => [...actual, nuevoPlato]);

    // Enter edit mode immediately to assign ingredients.
    setEditingPlatoId(nuevoPlato.id);
    setIngredientesSeleccionados(nuevoPlato.ingredientes_requeridos ?? []);
    setIngredientesBorrador(nuevoPlato.ingredientes_requeridos ?? []);
    setIngredienteQuery("");
    setIsIngredienteDropdownOpen(true);

    setNombre("");
    setCategoria("Otsumami");
    setIsSaving(false);
  };

  const eliminarPlato = async () => {
    if (!confirmDeletePlato) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("platos")
      .delete()
      .eq("id", confirmDeletePlato.id);

    if (deleteError) {
      setError(deleteError.message);
      setIsDeleting(false);
      return;
    }

    setPlatos((actual) =>
      actual.filter((plato) => plato.id !== confirmDeletePlato.id)
    );

    if (editingPlatoId === confirmDeletePlato.id) {
      setEditingPlatoId(null);
      setIngredientesSeleccionados([]);
      setIngredientesBorrador([]);
      setIngredienteQuery("");
      setIsIngredienteDropdownOpen(false);
    }

    setConfirmDeletePlato(null);
    setIsDeleting(false);
  };

  const estaDisponible = (plato: Plato) => {
    const requeridos = plato.ingredientes_requeridos ?? [];
    return requeridos.every((ingredienteId) => {
      const ingrediente = ingredientesPorId.get(ingredienteId);
      return ingrediente ? ingrediente.disponible : false;
    });
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Biblioteca de Platos</h1>
        </header>

        <form onSubmit={guardarPlato} className="mb-8 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.16em] text-zinc-500">
            Crear nuevo plato
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Nombre"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
            <select
              value={categoria}
              onChange={(event) => setCategoria(event.target.value as Categoria)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            >
              {CATEGORIAS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 p-2 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Crear plato"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {confirmDeletePlato ? (
          <div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4">
            <p className="text-sm text-zinc-200">
              ¿Eliminar <span className="font-medium">{confirmDeletePlato.nombre}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void eliminarPlato()}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Confirmar eliminación
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeletePlato(null)}
                disabled={isDeleting}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando platos...
          </div>
        ) : (
          <div className="space-y-6">
            {platosPorCategoria.map((bloque) => (
              <section key={bloque.categoria}>
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-500">
                  {bloque.categoria}
                </h2>
                {bloque.platos.length === 0 ? (
                  <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-500">
                    Sin platos en esta categoría.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {bloque.platos.map((plato) => {
                      const disponible = estaDisponible(plato);
                      const ingredientesDelPlato = (plato.ingredientes_requeridos ?? [])
                        .map((id) => ingredientesPorId.get(id)?.nombre)
                        .filter(Boolean);

                      return (
                        <li
                          key={plato.id}
                          onClick={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest("button,input,select,textarea")) {
                              return;
                            }
                            iniciarEdicion(plato);
                          }}
                          className={`rounded-xl border bg-zinc-950/70 px-4 py-3 ${
                            editingPlatoId === plato.id
                              ? "border-zinc-500"
                              : "border-zinc-800 hover:border-zinc-600"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-zinc-100">
                              {plato.nombre}
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs ${
                                  disponible
                                    ? "border-emerald-800 bg-emerald-950/50 text-emerald-200"
                                    : "border-amber-800 bg-amber-950/50 text-amber-200"
                                }`}
                              >
                                {disponible ? "Disponible" : "Agotado"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePlato(plato)}
                                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 p-2 text-zinc-300 transition hover:border-red-700 hover:text-red-200"
                                aria-label={`Eliminar ${plato.nombre}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">
                            {ingredientesDelPlato.length > 0
                              ? ingredientesDelPlato.join(" · ")
                              : "Sin ingredientes asignados"}
                          </p>
                          {editingPlatoId === plato.id ? (
                            <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
                              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                                Ingredientes (dropdown multi-selección)
                              </p>
                              <button
                                type="button"
                                onClick={abrirSelectorIngredientes}
                                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-100 transition hover:border-zinc-500"
                              >
                                {`Seleccionar ingredientes (${ingredientesSeleccionados.length})`}
                              </button>

                              {isIngredienteDropdownOpen ? (
                                <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-950 p-2">
                                  <input
                                    value={ingredienteQuery}
                                    onChange={(event) =>
                                      setIngredienteQuery(event.target.value)
                                    }
                                    placeholder="Buscar ingrediente..."
                                    className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                                  />
                                  <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                                    {ingredienteQuery.trim() && !ingredienteYaExiste ? (
                                      <button
                                        type="button"
                                        onClick={() => void agregarIngredienteDesdeDropdown()}
                                        disabled={isAddingIngrediente}
                                        className="mb-2 flex w-full items-center justify-between rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <span>{`Agregar "${ingredienteQuery.trim()}"`}</span>
                                        {isAddingIngrediente ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Plus className="h-4 w-4" />
                                        )}
                                      </button>
                                    ) : null}

                                    {ingredientesFiltrados.length > 0 ? (
                                      ingredientesFiltrados.map((ingrediente) => {
                                        const selected = ingredientesBorrador.includes(
                                          ingrediente.id
                                        );

                                        return (
                                          <button
                                            key={ingrediente.id}
                                            type="button"
                                            onClick={() =>
                                              toggleIngredienteBorrador(ingrediente.id)
                                            }
                                            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                              selected
                                                ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                                                : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
                                            }`}
                                          >
                                            <span>{ingrediente.nombre}</span>
                                            <span className="text-xs opacity-70">
                                              {selected ? "Seleccionado" : "Agregar"}
                                            </span>
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <p className="px-1 py-2 text-sm text-zinc-500">
                                        No se encontraron ingredientes.
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void confirmarSelectorIngredientes()}
                                      disabled={isUpdatingIngredientes}
                                      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isUpdatingIngredientes ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : null}
                                      Confirmar selección
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelarSelectorIngredientes}
                                      disabled={isUpdatingIngredientes}
                                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
