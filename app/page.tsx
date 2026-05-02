"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";

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

const CATEGORIAS_OMAKASE: Categoria[] = ["Otsumami", "Nigiri", "Postre"];
const TOTAL_ITEMS_OMAKASE = 17;

export default function Home() {
  const now = new Date();
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [seleccionOmakase, setSeleccionOmakase] = useState<string[]>([]);
  const [seleccionExtensiones, setSeleccionExtensiones] = useState<string[]>([]);
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

  const ingredientesMap = useMemo(() => {
    return new Map(ingredientes.map((item) => [item.id, item]));
  }, [ingredientes]);

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

  const omakasePorCategoria = useMemo(() => {
    let numero = 0;
    return CATEGORIAS_OMAKASE.map((categoria) => {
      const items = menuOmakaseDisponibles
        .filter((plato) => plato.categoria === categoria)
        .map((plato) => ({
          plato,
          numero: ++numero,
        }));

      return { categoria, items };
    });
  }, [menuOmakaseDisponibles]);

  const extensionesDisponibles = useMemo(() => {
    return platosConEstado.filter(
      (plato) => plato.categoria === "Extensión" && plato.disponible
    );
  }, [platosConEstado]);

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

  const toggleSeleccion = (
    platoId: string,
    setSeleccion: Dispatch<SetStateAction<string[]>>
  ) => {
    setSeleccion((actual) =>
      actual.includes(platoId)
        ? actual.filter((id) => id !== platoId)
        : [...actual, platoId]
    );
  };

  const toggleSeleccionOmakase = (platoId: string) => {
    const yaSeleccionado = seleccionOmakase.includes(platoId);
    if (!yaSeleccionado && seleccionOmakase.length >= TOTAL_ITEMS_OMAKASE) {
      setError(`El Menú Omakase debe tener un máximo de ${TOTAL_ITEMS_OMAKASE} items.`);
      return;
    }

    setError(null);
    toggleSeleccion(platoId, setSeleccionOmakase);
  };

  const cerrarYGuardarMenu = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    if (seleccionOmakase.length !== TOTAL_ITEMS_OMAKASE) {
      setError(
        `El Menú Omakase debe tener exactamente ${TOTAL_ITEMS_OMAKASE} items antes de guardar.`
      );
      setIsSaving(false);
      return;
    }

    const payload: HistorialPayload = {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      menu_omakase: seleccionOmakase,
      extensiones: seleccionExtensiones,
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
    setIsSaving(false);
  };

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

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando platos e ingredientes...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                  Menú Omakase ({seleccionOmakase.length}/{TOTAL_ITEMS_OMAKASE})
                </h2>
                {menuOmakaseDisponibles.length > 0 ? (
                  <div className="space-y-4">
                    {omakasePorCategoria.map((bloque) => (
                      <div key={bloque.categoria}>
                        <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                          {bloque.categoria}
                        </h3>
                        {bloque.items.length > 0 ? (
                          <div className="space-y-2">
                            {bloque.items.map(({ plato, numero }) =>
                              renderCard(
                                plato,
                                seleccionOmakase.includes(plato.id),
                                () => toggleSeleccionOmakase(plato.id),
                                false,
                                numero
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-600">
                            Sin platos disponibles en esta categoría.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No hay platos omakase disponibles.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                  Extensiones / Extras
                </h2>
                <div className="space-y-2">
                  {extensionesDisponibles.length > 0 ? (
                    extensionesDisponibles.map((plato) =>
                      renderCard(
                        plato,
                        seleccionExtensiones.includes(plato.id),
                        () =>
                          toggleSeleccion(
                            plato.id,
                            setSeleccionExtensiones
                          )
                      )
                    )
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No hay extensiones disponibles.
                    </p>
                  )}
                </div>
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
                  Seleccionados: {seleccionOmakase.length}/{TOTAL_ITEMS_OMAKASE} omakase /{" "}
                  {seleccionExtensiones.length} extensiones
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
      </section>
    </main>
  );
}
