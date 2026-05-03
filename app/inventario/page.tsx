"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/src/lib/supabase";

type Ingrediente = {
  id: string;
  nombre: string;
  disponible: boolean;
};

export default function InventarioPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [nuevoIngrediente, setNuevoIngrediente] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItems = useMemo(() => ingredientes.length > 0, [ingredientes.length]);

  const cargarIngredientes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("ingredientes")
        .select("id, nombre, disponible")
        .order("nombre", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setIngredientes((data as Ingrediente[]) ?? []);
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
      setError(updateError.message);
    }
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
      .insert({ nombre, disponible: true })
      .select("id, nombre, disponible")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    setIngredientes((current) =>
      [...current, data as Ingrediente].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es")
      )
    );
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
      setError(deleteError.message);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Omakase</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Ingredientes</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Disponibilidad y altas para armar los platos.
          </p>
        </header>

        <form onSubmit={agregarIngrediente} className="mb-6 flex gap-2">
          <input
            value={nuevoIngrediente}
            onChange={(event) => setNuevoIngrediente(event.target.value)}
            placeholder="Agregar nuevo ingrediente"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
            No hay ingredientes todavía. Agrega el primero.
          </p>
        ) : (
          <ul className="space-y-2">
            {ingredientes.map((ingrediente) => (
              <li
                key={ingrediente.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"
              >
                <span className="text-sm text-zinc-100">{ingrediente.nombre}</span>
                <div className="flex items-center gap-3">
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
                    className={`relative h-6 w-11 rounded-full transition ${
                      ingrediente.disponible ? "bg-zinc-100" : "bg-zinc-700"
                    }`}
                    aria-label={`Cambiar disponibilidad de ${ingrediente.nombre}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 transition ${
                        ingrediente.disponible ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void eliminarIngrediente(ingrediente.id)}
                    className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
                    aria-label={`Eliminar ${ingrediente.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
