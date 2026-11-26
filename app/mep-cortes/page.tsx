"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  CircleAlert,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import {
  Boton,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Fila,
  Interruptor,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  useAvisos,
} from "@/app/ui";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  UNIDADES_MEP,
  agruparCortesPorCategoria,
  categoriasExistentes,
  corteDesdeFila,
  etiquetaUnidadMep,
  fetchMepCortesTodos,
  type MepCorte,
  type MepCorteDbRow,
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
  const { confirmar } = useAvisos();

  const grupos = useMemo(() => agruparCortesPorCategoria(cortes), [cortes]);
  const categoriasSugeridas = useMemo(
    () => categoriasExistentes(cortes),
    [cortes],
  );
  const ocultos = cortes.filter((c) => !c.activo).length;

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const lista = await fetchMepCortesTodos();
      setCortes(lista);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
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
      (c) => c.categoria.toLowerCase() === categoriaLimpia.toLowerCase(),
    );
    const maxOrden = enCategoria.reduce((m, c) => Math.max(m, c.orden), 0);

    const { data, error: insertError } = await supabase
      .from("mep_cortes")
      .insert({
        categoria: categoriaLimpia,
        nombre: nombreLimpio,
        // Columna legacy en DB antigua (NOT NULL); la app usa solo categoria.
        pescado: categoriaLimpia,
        unidad,
        orden: maxOrden + 10,
      })
      .select("id, categoria, nombre, unidad, peso_ref, orden, activo")
      .single();

    if (insertError) {
      const msg = insertError.message.toLowerCase();
      if (
        msg.includes("mep_cortes_categoria_nombre_unq") ||
        msg.includes("duplicate key")
      ) {
        setError(
          `${formatPostgrestError(insertError)} Ya existe un ítem con esa categoría y nombre.`,
        );
      } else {
        setError(formatPostgrestError(insertError));
      }
      setIsSaving(false);
      return;
    }

    setCortes((actual) => [...actual, corteDesdeFila(data as MepCorteDbRow)]);
    setNombre("");
    setIsSaving(false);
  };

  const toggleActivo = async (corte: MepCorte) => {
    setError(null);
    const { data, error: updateError } = await supabase
      .from("mep_cortes")
      .update({ activo: !corte.activo, updated_at: new Date().toISOString() })
      .eq("id", corte.id)
      .select("id, categoria, nombre, unidad, peso_ref, orden, activo")
      .single();

    if (updateError) {
      setError(formatPostgrestError(updateError));
      return;
    }

    setCortes((actual) =>
      actual.map((c) =>
        c.id === corte.id ? corteDesdeFila(data as MepCorteDbRow) : c,
      ),
    );
  };

  const eliminarCorte = async (corte: MepCorte) => {
    const ok = await confirmar({
      titulo: `¿Borrar ${corte.categoria} · ${corte.nombre}?`,
      texto:
        "Las cargas anteriores lo conservan, pero ya no va a aparecer en las MEP nuevas.",
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) {
      return;
    }

    setError(null);

    const { error: deleteError } = await supabase
      .from("mep_cortes")
      .delete()
      .eq("id", corte.id);

    if (deleteError) {
      setError(formatPostgrestError(deleteError));
      return;
    }

    setCortes((actual) => actual.filter((c) => c.id !== corte.id));
  };

  return (
    <Pantalla
      titulo="Catálogo MEP"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${cortes.length} ${cortes.length === 1 ? "ítem" : "ítems"}${
              ocultos > 0
                ? ` · ${ocultos} ${ocultos === 1 ? "oculto" : "ocultos"}`
                : ""
            }`
      }
      ayuda={
        <>
          <p>
            Lo que aparece para cargar en la MEP Deli. Las categorías son libres
            (Nigiri, Sashimi, Relleno maki…): escribí una nueva o elegí una que
            ya exista.
          </p>
          <p>
            Apagá el interruptor de un ítem para ocultarlo de la MEP sin
            borrarlo. Para borrarlo, deslizá la fila hacia la izquierda.
          </p>
          <p>
            Si migrás desde la versión anterior y no aparece nada, falta correr{" "}
            <code className="text-label">
              supabase/mep-cortes-categoria.sql
            </code>
            .
          </p>
        </>
      }
      acciones={
        <Link
          href="/mep-deli"
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-fill pl-2.5 pr-3.5 text-[0.92rem] font-semibold text-label transition hover:bg-fill-strong active:scale-[0.97]"
        >
          <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          MEP Deli
        </Link>
      }
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      <Seccion titulo="Agregar ítem">
        <form
          onSubmit={guardarCorte}
          className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Categoría"
              list="mep-categorias"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej. Nigiri"
              autoComplete="off"
              enterKeyHint="next"
            />
            <Campo
              label="Ítem"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Salmón, Atún"
              enterKeyHint="done"
            />
          </div>
          <datalist id="mep-categorias">
            {categoriasSugeridas.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          <div>
            <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
              Unidad
            </p>
            <Segmentado<UnidadMep>
              etiqueta="Unidad"
              valor={unidad}
              onChange={setUnidad}
              opciones={UNIDADES_MEP.map((u) => ({
                valor: u,
                label: etiquetaUnidadMep(u),
              }))}
            />
          </div>
          <Boton
            type="submit"
            ancho
            cargando={isSaving}
            disabled={!categoria.trim() || !nombre.trim()}
            icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
          >
            Agregar
          </Boton>
        </form>
      </Seccion>

      {isLoading ? (
        <div className="mt-6">
          <EsqueletoLista filas={6} />
        </div>
      ) : grupos.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface-3">
          <EstadoVacio
            icono={<ListChecks className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay ítems"
            texto="Agregá el primero arriba."
          />
        </div>
      ) : (
        grupos.map((grupo) => (
          <Seccion
            key={grupo.categoria}
            titulo={`${grupo.categoria} · ${grupo.cortes.length}`}
          >
            <Lista>
              {grupo.cortes.map((corte) => (
                <Fila
                  key={corte.id}
                  titulo={
                    <span className={corte.activo ? undefined : "text-label-3"}>
                      {corte.nombre}
                      {corte.peso_ref ? (
                        <span className="ml-1.5 text-[0.8rem] tabular-nums text-warning">
                          {corte.peso_ref}
                        </span>
                      ) : null}
                    </span>
                  }
                  detalle={
                    <>
                      {etiquetaUnidadMep(corte.unidad)}
                      {corte.activo ? null : " · oculto en la MEP"}
                    </>
                  }
                  chevron={false}
                  valor={
                    <Interruptor
                      etiqueta={`${corte.nombre} visible en la MEP`}
                      activo={corte.activo}
                      onChange={() => void toggleActivo(corte)}
                    />
                  }
                  acciones={[
                    {
                      label: "Borrar",
                      tono: "peligro",
                      icono: <Trash2 className="h-5 w-5" aria-hidden />,
                      onClick: () => void eliminarCorte(corte),
                    },
                  ]}
                />
              ))}
            </Lista>
          </Seccion>
        ))
      )}
    </Pantalla>
  );
}
