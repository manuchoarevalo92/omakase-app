"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  UNIDADES_MEP,
  agruparCortesPorCategoria,
  categoriasExistentes,
  etiquetaUnidadMep,
  fetchMepCortesTodos,
  type MepCorte,
  type UnidadMep,
} from "@/src/lib/mep-deli";
import { supabase } from "@/src/lib/supabase";

export default function MepCortesPage() {
  const [cortes, setCortes] = useState<MepCorte[]>([]);
  const [categoria, setCategoria] = useState("");
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<UnidadMep>("g");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MepCorte | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const grupos = useMemo(() => agruparCortesPorCategoria(cortes), [cortes]);
  const categoriasSugeridas = useMemo(() => categoriasExistentes(cortes), [cortes]);

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const lista = await fetchMepCortesTodos();
      setCortes(lista);
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
    return () => window.clearTimeout(timer);
  }, []);

  const guardarCorte = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const categoriaLimpia = categoria.trim();
    const nombreLimpio = nombre.trim();
    if (!categoriaLimpia || !nombreLimpio) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const enCategoria = cortes.filter(
      (c) => c.categoria.toLowerCase() === categoriaLimpia.toLowerCase()
    );
    const maxOrden = enCategoria.reduce((m, c) => Math.max(m, c.orden), 0);

    const { data, error: insertError } = await supabase
      .from("mep_cortes")
      .insert({
        categoria: categoriaLimpia,
        nombre: nombreLimpio,
        unidad,
        orden: maxOrden + 10,
      })
      .select("id, categoria, nombre, unidad, orden, activo")
      .single();

    if (insertError) {
      setError(formatPostgrestError(insertError));
      setIsSaving(false);
      return;
    }

    setCortes((actual) => [...actual, data as MepCorte]);
    setNombre("");
    setIsSaving(false);
  };

  const toggleActivo = async (corte: MepCorte) => {
    setError(null);
    const { data, error: updateError } = await supabase
      .from("mep_cortes")
      .update({ activo: !corte.activo, updated_at: new Date().toISOString() })
      .eq("id", corte.id)
      .select("id, categoria, nombre, unidad, orden, activo")
      .single();

    if (updateError) {
      setError(formatPostgrestError(updateError));
      return;
    }

    setCortes((actual) =>
      actual.map((c) => (c.id === corte.id ? (data as MepCorte) : c))
    );
  };

  const eliminarCorte = async () => {
    if (!confirmDelete) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("mep_cortes")
      .delete()
      .eq("id", confirmDelete.id);

    if (deleteError) {
      setError(formatPostgrestError(deleteError));
      setIsDeleting(false);
      return;
    }

    setCortes((actual) => actual.filter((c) => c.id !== confirmDelete.id));
    setConfirmDelete(null);
    setIsDeleting(false);
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Catálogo MEP</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Definí categorías libres (Nigiri, Sashimi, Relleno maki…) y los ítems de cada una.
            </p>
          </div>
          <Link
            href="/mep-deli"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            ← MEP Deli
          </Link>
        </header>

        <form onSubmit={guardarCorte} className="mb-8 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.16em] text-zinc-500">
            Agregar ítem
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <input
                list="mep-categorias"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Categoría (ej. Nigiri)"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
              />
              <datalist id="mep-categorias">
                {categoriasSugeridas.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ítem (ej. Salmón, Atún)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as UnidadMep)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            >
              {UNIDADES_MEP.map((u) => (
                <option key={u} value={u}>
                  {etiquetaUnidadMep(u)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-zinc-500">
            La categoría es texto libre: podés escribir una nueva o elegir una que ya exista.
          </p>
          <button
            type="submit"
            disabled={isSaving || !categoria.trim() || !nombre.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </form>

        {error && (
          <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando catálogo…
          </div>
        ) : grupos.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No hay ítems cargados. Agregá el primero arriba o ejecutá{" "}
            <code className="text-zinc-300">supabase/mep-cortes-categoria.sql</code> si migrás
            desde la versión anterior.
          </p>
        ) : (
          <div className="space-y-6">
            {grupos.map((grupo) => (
              <div key={grupo.categoria}>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
                  {grupo.categoria}
                </h3>
                <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                  {grupo.cortes.map((corte) => (
                    <li
                      key={corte.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        corte.activo ? "" : "opacity-50"
                      }`}
                    >
                      <div>
                        <span className="font-medium text-zinc-100">{corte.nombre}</span>
                        <span className="ml-2 text-xs text-zinc-500">
                          {etiquetaUnidadMep(corte.unidad)}
                        </span>
                        {!corte.activo && (
                          <span className="ml-2 text-xs text-amber-500">(inactivo)</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleActivo(corte)}
                          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                        >
                          {corte.activo ? "Ocultar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(corte)}
                          className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition hover:border-red-900 hover:text-red-400"
                          aria-label={`Eliminar ${corte.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Eliminar ítem</h3>
            <p className="mt-2 text-sm text-zinc-400">
              ¿Borrar{" "}
              <span className="text-zinc-200">
                {confirmDelete.categoria} · {confirmDelete.nombre}
              </span>
              ? Las cargas históricas conservan el id pero ya no aparecerá en nuevas MEP.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void eliminarCorte()}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
