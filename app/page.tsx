"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Lock, Pencil } from "lucide-react";

import { supabase } from "@/src/lib/supabase";

type Categoria = "Otsumami" | "Nigiri" | "Postre" | "Extensión";
type Servicio = "Mediodia" | "Noche";

type Ingrediente = {
  id: string;
  nombre: string;
  disponible: boolean;
};

type Plato = {
  id: string;
  nombre: string;
  categoria: Categoria;
  ingredientes_requeridos: string[] | null;
};

type HistorialPayload = {
  fecha: string;
  hora: string;
  servicio: Servicio;
  menu_omakase: string[];
  extensiones: string[];
};

type ResumenServicio = {
  fecha: string;
  hora: string;
  servicio: Servicio;
  otsumamiBase: string[];
  nigiri: string[];
  postre: string[];
  regalo: string[];
  extensiones: string[];
};

const CATEGORIAS_OMAKASE: Categoria[] = ["Otsumami", "Nigiri", "Postre"];
const TOTAL_ITEMS_OMAKASE = 17;
const OTSUMAMI_BASE = 4;
const OTSUMAMI_REGALO = 2;
const NIGIRI_BASE = 12;
const POSTRE_BASE = 1;
const EXTENSION_SLOTS = 5;
const CATEGORIAS_EXTRAS: Categoria[] = ["Otsumami", "Nigiri", "Extensión"];

export default function Home() {
  const now = new Date();
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [omakaseOtsumami, setOmakaseOtsumami] = useState<string[]>(
    () => Array.from({ length: OTSUMAMI_BASE }, () => "")
  );
  const [omakaseOtsumamiRegalo, setOmakaseOtsumamiRegalo] = useState<string[]>(
    () => Array.from({ length: OTSUMAMI_REGALO }, () => "")
  );
  const [omakaseNigiri, setOmakaseNigiri] = useState<string[]>(
    () => Array.from({ length: NIGIRI_BASE }, () => "")
  );
  const [omakasePostre, setOmakasePostre] = useState<string[]>(
    () => Array.from({ length: POSTRE_BASE }, () => "")
  );
  const [extensionSlots, setExtensionSlots] = useState<string[]>(() =>
    Array.from({ length: EXTENSION_SLOTS }, () => "")
  );
  const [fechaServicio, setFechaServicio] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`
  );
  const [horaServicio, setHoraServicio] = useState(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
      2,
      "0"
    )}`
  );
  const [servicio, setServicio] = useState<Servicio>(
    now.getHours() < 17 ? "Mediodia" : "Noche"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resumenServicio, setResumenServicio] = useState<ResumenServicio | null>(
    null
  );
  /** Tras guardar, el formulario se pliega para priorizar el resumen; "Editar menú" lo vuelve a mostrar. */
  const [editorOcultoTrasGuardar, setEditorOcultoTrasGuardar] = useState(false);

  const ingredientesMap = useMemo(() => {
    return new Map(ingredientes.map((item) => [item.id, item]));
  }, [ingredientes]);

  const platosPorId = useMemo(() => {
    return new Map(platos.map((p) => [p.id, p]));
  }, [platos]);

  const platosConEstado = useMemo(() => {
    return platos.map((plato) => ({
      ...plato,
      disponible: (plato.ingredientes_requeridos ?? []).every((ingredienteId) => {
        const ingrediente = ingredientesMap.get(ingredienteId);
        return ingrediente ? ingrediente.disponible : false;
      }),
    }));
  }, [platos, ingredientesMap]);

  const menuOmakaseDisponibles = useMemo(() => {
    return platosConEstado.filter(
      (plato) =>
        CATEGORIAS_OMAKASE.includes(plato.categoria) && plato.disponible
    );
  }, [platosConEstado]);

  const omakaseOpcionesPorCategoria = useMemo(() => {
    const map = new Map<Categoria, (Plato & { disponible: boolean })[]>(
      CATEGORIAS_OMAKASE.map((categoria) => [categoria, []])
    );
    menuOmakaseDisponibles.forEach((plato) => {
      const current = map.get(plato.categoria) ?? [];
      current.push(plato);
      map.set(plato.categoria, current);
    });
    return map;
  }, [menuOmakaseDisponibles]);

  const pasosBaseCompletados = useMemo(() => {
    return [
      ...omakaseOtsumami,
      ...omakaseNigiri,
      ...omakasePostre,
    ].filter((id) => id.trim().length > 0).length;
  }, [omakaseNigiri, omakaseOtsumami, omakasePostre]);

  const pasosRegaloCompletados = useMemo(
    () => omakaseOtsumamiRegalo.filter((id) => id.trim().length > 0).length,
    [omakaseOtsumamiRegalo]
  );

  const extrasDisponiblesPorCategoria = useMemo(() => {
    const map = new Map<Categoria, (Plato & { disponible: boolean })[]>(
      CATEGORIAS_EXTRAS.map((categoria) => [categoria, []])
    );
    platosConEstado.forEach((plato) => {
      if (!plato.disponible || !CATEGORIAS_EXTRAS.includes(plato.categoria)) {
        return;
      }
      const current = map.get(plato.categoria) ?? [];
      current.push(plato);
      map.set(plato.categoria, current);
    });
    return map;
  }, [platosConEstado]);

  const extrasDisponiblesTotal = useMemo(() => {
    return CATEGORIAS_EXTRAS.reduce(
      (acc, cat) => acc + (extrasDisponiblesPorCategoria.get(cat)?.length ?? 0),
      0
    );
  }, [extrasDisponiblesPorCategoria]);

  const platosNoDisponibles = useMemo(() => {
    return platosConEstado.filter((plato) => !plato.disponible);
  }, [platosConEstado]);

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ingredientesResponse, platosResponse] = await Promise.all([
        supabase
          .from("ingredientes")
          .select("id, nombre, disponible")
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

  const actualizarPasoOmakase = (
    index: number,
    platoId: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setError(null);
    setter((actual) =>
      actual.map((item, i) => (i === index ? platoId : item))
    );
  };

  const actualizarExtensionSlot = (index: number, platoId: string) => {
    setError(null);
    setExtensionSlots((actual) =>
      actual.map((item, i) => (i === index ? platoId : item))
    );
  };

  const esOpcionDuplicadaEnSeccion = (
    seccion: string[],
    indexActual: number,
    platoId: string
  ) => {
    return seccion.some((id, i) => i !== indexActual && id === platoId);
  };

  const cerrarYGuardarMenu = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    if (pasosBaseCompletados !== TOTAL_ITEMS_OMAKASE) {
      setError(
        `Completa los ${TOTAL_ITEMS_OMAKASE} pasos del Menú Omakase antes de guardar.`
      );
      setIsSaving(false);
      return;
    }

    const menuOmakaseFinal = [
      ...omakaseOtsumami,
      ...omakaseNigiri,
      ...omakasePostre,
      ...omakaseOtsumamiRegalo,
    ].filter((id) => id.trim().length > 0);

    const payload: HistorialPayload = {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      menu_omakase: menuOmakaseFinal,
      extensiones: extensionSlots.filter((id) => id.trim().length > 0),
    };

    const { error: saveError } = await supabase
      .from("historial_servicios")
      .insert(payload);

    if (saveError) {
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    setSuccess(`Menú guardado para ${fechaServicio} (${servicio} - ${horaServicio}).`);
    setResumenServicio({
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      otsumamiBase: omakaseOtsumami.filter((id) => id.trim().length > 0),
      nigiri: omakaseNigiri.filter((id) => id.trim().length > 0),
      postre: omakasePostre.filter((id) => id.trim().length > 0),
      regalo: omakaseOtsumamiRegalo.filter((id) => id.trim().length > 0),
      extensiones: extensionSlots.filter((id) => id.trim().length > 0),
    });
    setEditorOcultoTrasGuardar(true);
    setIsSaving(false);
  };

  const nombrePlato = (id: string) =>
    platosPorId.get(id)?.nombre ?? "Plato no encontrado";

  const renderCard = (
    plato: Plato & { disponible: boolean },
    selected: boolean,
    onClick: () => void,
    blocked = false,
    numero?: number
  ) => {
    const ingredientesTexto = (plato.ingredientes_requeridos ?? [])
      .map((id) => ingredientesMap.get(id)?.nombre)
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        key={plato.id}
        type="button"
        onClick={onClick}
        disabled={blocked}
        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
          blocked
            ? "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500"
            : selected
              ? "border-zinc-200 bg-zinc-100 text-zinc-900"
              : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {numero ? `${numero}. ` : ""}
            {plato.nombre}
          </span>
          {blocked ? (
            <Lock className="h-4 w-4 shrink-0" />
          ) : selected ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : null}
        </div>
        <p className="mt-1 text-xs opacity-75">
          {ingredientesTexto || "Sin ingredientes asignados"}
        </p>
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur sm:p-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Omakase</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Generador de Menú Diario
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Selecciona platos disponibles para el servicio y guarda el cierre del
            menú del día.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mb-4 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {resumenServicio ? (
          <div className="sticky top-2 z-10 mb-6 rounded-lg border border-zinc-600 bg-zinc-950/95 p-3 shadow-lg shadow-black/40 backdrop-blur-sm sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Menú en servicio
                </p>
                <p className="mt-0.5 text-xs text-zinc-200">
                  <span className="tabular-nums">{resumenServicio.fecha}</span>
                  <span className="text-zinc-600"> · </span>
                  <span className="tabular-nums">{resumenServicio.hora}</span>
                  <span className="text-zinc-600"> · </span>
                  {resumenServicio.servicio}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOcultoTrasGuardar(false)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Editar menú
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResumenServicio(null);
                    setSuccess(null);
                    setEditorOcultoTrasGuardar(false);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                >
                  Ocultar resumen
                </button>
              </div>
            </div>
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-5">
                {resumenServicio.otsumamiBase.length > 0 ? (
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Otsumami
                    </p>
                    <ul className="space-y-0.5 text-[13px] leading-snug text-zinc-100">
                      {resumenServicio.otsumamiBase.map((id, i) => (
                        <li key={`r-otsu-${id}-${i}`} className="flex gap-1.5">
                          <span className="w-4 shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0 break-words">{nombrePlato(id)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {resumenServicio.nigiri.length > 0 ? (
                  <div className="min-w-0 sm:row-span-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Nigiri
                    </p>
                    <ul className="columns-1 gap-x-4 sm:columns-2 sm:text-[12px]">
                      {resumenServicio.nigiri.map((id, i) => (
                        <li
                          key={`r-nig-${id}-${i}`}
                          className="mb-0.5 flex break-inside-avoid gap-1.5 pr-1 leading-snug text-zinc-100"
                        >
                          <span className="w-4 shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0 break-words">{nombrePlato(id)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="min-w-0 space-y-2 sm:col-start-1">
                  {resumenServicio.postre.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Postre
                      </p>
                      <ul className="space-y-0.5 text-[13px] leading-snug text-zinc-100">
                        {resumenServicio.postre.map((id, i) => (
                          <li key={`r-post-${id}-${i}`} className="break-words">
                            {nombrePlato(id)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {resumenServicio.regalo.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Regalo
                      </p>
                      <ul className="space-y-0.5 text-[13px] leading-snug text-zinc-100">
                        {resumenServicio.regalo.map((id, i) => (
                          <li key={`r-reg-${id}-${i}`} className="break-words">
                            {nombrePlato(id)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
              {resumenServicio.extensiones.length > 0 ? (
                <div className="mt-3 border-t border-zinc-800 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Extras
                  </p>
                  <ul className="columns-1 gap-x-4 sm:columns-2 sm:text-[12px]">
                    {resumenServicio.extensiones.map((id, i) => (
                      <li
                        key={`r-ext-${id}-${i}`}
                        className="mb-0.5 flex break-inside-avoid gap-1.5 pr-1 leading-snug text-zinc-100"
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="min-w-0 break-words">{nombrePlato(id)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando platos e ingredientes...
          </div>
        ) : (
          <>
            {editorOcultoTrasGuardar ? (
              <p className="mb-4 text-center text-xs text-zinc-500">
                Formulario oculto. Tocá <span className="text-zinc-400">Editar menú</span> en el
                resumen de arriba para cambios de último minuto.
              </p>
            ) : (
            <>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                  Menú Omakase (Base {pasosBaseCompletados}/{TOTAL_ITEMS_OMAKASE}
                  {" · "}Regalo {pasosRegaloCompletados}/{OTSUMAMI_REGALO})
                </h2>
                {menuOmakaseDisponibles.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Otsumami (4 base)
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {omakaseOtsumami.map((valor, index) => (
                          <div
                            key={`otsu-base-${index + 1}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                          >
                            <label
                              htmlFor={`otsu-base-${index + 1}`}
                              className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500"
                            >
                              Otsumami {index + 1}
                            </label>
                            <select
                              id={`otsu-base-${index + 1}`}
                              value={valor}
                              onChange={(event) =>
                                actualizarPasoOmakase(
                                  index,
                                  event.target.value,
                                  setOmakaseOtsumami
                                )
                              }
                              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                            >
                              <option value="">Seleccionar Otsumami...</option>
                              {(omakaseOpcionesPorCategoria.get("Otsumami") ?? []).map(
                                (plato) => (
                                  <option
                                    key={plato.id}
                                    value={plato.id}
                                    disabled={esOpcionDuplicadaEnSeccion(
                                      omakaseOtsumami,
                                      index,
                                      plato.id
                                    )}
                                  >
                                    {plato.nombre}
                                  </option>
                                )
                              )}
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
                        {omakaseOtsumamiRegalo.map((valor, index) => (
                          <div
                            key={`otsu-regalo-${index + 1}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                          >
                            <label
                              htmlFor={`otsu-regalo-${index + 1}`}
                              className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500"
                            >
                              Regalo {index + 1}
                            </label>
                            <select
                              id={`otsu-regalo-${index + 1}`}
                              value={valor}
                              onChange={(event) =>
                                actualizarPasoOmakase(
                                  index,
                                  event.target.value,
                                  setOmakaseOtsumamiRegalo
                                )
                              }
                              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                            >
                              <option value="">Sin regalo</option>
                              {(omakaseOpcionesPorCategoria.get("Otsumami") ?? []).map(
                                (plato) => (
                                  <option
                                    key={plato.id}
                                    value={plato.id}
                                    disabled={esOpcionDuplicadaEnSeccion(
                                      omakaseOtsumamiRegalo,
                                      index,
                                      plato.id
                                    )}
                                  >
                                    {plato.nombre}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Nigiri (12)
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {omakaseNigiri.map((valor, index) => (
                          <div
                            key={`nigiri-${index + 1}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                          >
                            <label
                              htmlFor={`nigiri-${index + 1}`}
                              className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500"
                            >
                              Nigiri {index + 1}
                            </label>
                            <select
                              id={`nigiri-${index + 1}`}
                              value={valor}
                              onChange={(event) =>
                                actualizarPasoOmakase(
                                  index,
                                  event.target.value,
                                  setOmakaseNigiri
                                )
                              }
                              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                            >
                              <option value="">Seleccionar Nigiri...</option>
                              {(omakaseOpcionesPorCategoria.get("Nigiri") ?? []).map(
                                (plato) => (
                                  <option
                                    key={plato.id}
                                    value={plato.id}
                                    disabled={esOpcionDuplicadaEnSeccion(
                                      omakaseNigiri,
                                      index,
                                      plato.id
                                    )}
                                  >
                                    {plato.nombre}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Postre (1)
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {omakasePostre.map((valor, index) => (
                          <div
                            key={`postre-${index + 1}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                          >
                            <label
                              htmlFor={`postre-${index + 1}`}
                              className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500"
                            >
                              Postre
                            </label>
                            <select
                              id={`postre-${index + 1}`}
                              value={valor}
                              onChange={(event) =>
                                actualizarPasoOmakase(
                                  index,
                                  event.target.value,
                                  setOmakasePostre
                                )
                              }
                              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                            >
                              <option value="">Seleccionar Postre...</option>
                              {(omakaseOpcionesPorCategoria.get("Postre") ?? []).map(
                                (plato) => (
                                  <option
                                    key={plato.id}
                                    value={plato.id}
                                    disabled={esOpcionDuplicadaEnSeccion(
                                      omakasePostre,
                                      index,
                                      plato.id
                                    )}
                                  >
                                    {plato.nombre}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No hay platos omakase disponibles.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                  Extensiones / Extras ({extensionSlots.filter((id) => id).length}/
                  {EXTENSION_SLOTS})
                </h2>
                <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                  Hasta cinco extras opcionales: podés elegir Otsumami, Nigiri o platos de categoría
                  Extensión (solo disponibles).
                </p>
                {extrasDisponiblesTotal > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {extensionSlots.map((valor, index) => (
                      <div
                        key={`extra-${index + 1}`}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                      >
                        <label
                          htmlFor={`extra-${index + 1}`}
                          className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-zinc-500"
                        >
                          Extra {index + 1}
                        </label>
                        <select
                          id={`extra-${index + 1}`}
                          value={valor}
                          onChange={(event) =>
                            actualizarExtensionSlot(index, event.target.value)
                          }
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                        >
                          <option value="">Sin extra</option>
                          {CATEGORIAS_EXTRAS.map((categoria) => (
                            <optgroup key={categoria} label={categoria}>
                              {(extrasDisponiblesPorCategoria.get(categoria) ?? []).map(
                                (plato) => (
                                  <option
                                    key={plato.id}
                                    value={plato.id}
                                    disabled={esOpcionDuplicadaEnSeccion(
                                      extensionSlots,
                                      index,
                                      plato.id
                                    )}
                                  >
                                    {plato.nombre}
                                  </option>
                                )
                              )}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No hay platos disponibles para extras (Otsumami, Nigiri o Extensión).
                  </p>
                )}
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                No disponibles
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {platosNoDisponibles.length > 0 ? (
                  platosNoDisponibles.map((plato) =>
                    renderCard(plato, false, () => undefined, true)
                  )
                ) : (
                  <p className="text-sm text-zinc-500">
                    Todos los platos están disponibles.
                  </p>
                )}
              </div>
            </section>

            <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-400">
                  Seleccionados: {pasosBaseCompletados}/{TOTAL_ITEMS_OMAKASE} base +{" "}
                  {pasosRegaloCompletados}/{OTSUMAMI_REGALO} regalo /{" "}
                  {extensionSlots.filter((id) => id).length}/{EXTENSION_SLOTS} extras
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="date"
                    value={fechaServicio}
                    onChange={(event) => setFechaServicio(event.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                  />
                  <input
                    type="time"
                    value={horaServicio}
                    onChange={(event) => setHoraServicio(event.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                  />
                  <select
                    value={servicio}
                    onChange={(event) => setServicio(event.target.value as Servicio)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                  >
                    <option value="Mediodia">Mediodia</option>
                    <option value="Noche">Noche</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void cerrarYGuardarMenu()}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Cerrar Menú y Guardar"
                )}
              </button>
            </div>
            </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
