"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Plus,
  Search,
  Shapes,
  Trash2,
} from "lucide-react";
import {
  Boton,
  Campo,
  CampoBusqueda,
  cx,
  EsqueletoLista,
  EstadoVacio,
  Fila,
  HojaOpciones,
  Interruptor,
  Lista,
  Pantalla,
  Seccion,
  Selector,
  useAvisos,
  vibrar,
} from "@/app/ui";

import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
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
    {} as Record<RubroIngrediente, boolean>,
  );

/** A partir de cuántos ingredientes se muestra el buscador. */
const MINIMO_PARA_BUSCAR = 8;

function normalizarBusqueda(t: string): string {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export default function InventarioPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const { confirmar } = useAvisos();
  const [nuevoIngrediente, setNuevoIngrediente] = useState("");
  const [nuevoRubro, setNuevoRubro] =
    useState<RubroIngrediente>("Despensa/Prep");
  const [rubroExpandido, setRubroExpandido] = useState<
    Record<RubroIngrediente, boolean>
  >(RUBRO_EXPANDIDO_INICIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cambiandoRubro, setCambiandoRubro] = useState<Ingrediente | null>(
    null,
  );

  const hasItems = useMemo(
    () => ingredientes.length > 0,
    [ingredientes.length],
  );

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

  const clave = normalizarBusqueda(busqueda);
  const buscando = clave.length > 0;

  const agotados = useMemo(
    () => ingredientes.filter((i) => !i.disponible).length,
    [ingredientes],
  );

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
        })),
      );
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
      void cargarIngredientes();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const actualizarDisponibilidad = async (id: string, disponible: boolean) => {
    const previous = ingredientes;

    setIngredientes((current) =>
      current.map((item) => (item.id === id ? { ...item, disponible } : item)),
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
      current.map((item) => (item.id === id ? { ...item, rubro } : item)),
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
      ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    );
    setRubroExpandido((prev) => ({ ...prev, [rubroNuevo]: true }));
    setNuevoIngrediente("");
    setIsSubmitting(false);
  };

  const eliminarIngrediente = async (id: string) => {
    const nombre =
      ingredientes.find((item) => item.id === id)?.nombre ?? "este ingrediente";
    const ok = await confirmar({
      titulo: `¿Borrar «${nombre}»?`,
      texto:
        "También se quita de los platos que lo usan. No se puede deshacer.",
      confirmar: "Borrar ingrediente",
      peligro: true,
    });
    if (!ok) {
      return;
    }
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

    const { data: platosConIngrediente, error: fetchPlatosError } =
      await supabase
        .from("platos")
        .select("id, ingredientes_requeridos")
        .contains("ingredientes_requeridos", [id]);

    if (fetchPlatosError) {
      setError(
        `Ingrediente eliminado, pero no se pudo limpiar en platos: ${formatPostgrestError(
          fetchPlatosError,
        )}`,
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
          (ingredienteId) => ingredienteId !== id,
        );
        const { error: updatePlatoError } = await supabase
          .from("platos")
          .update({ ingredientes_requeridos: nuevos })
          .eq("id", plato.id);
        return updatePlatoError;
      }),
    );

    const primerError = updates.find((err) => err != null);
    if (primerError) {
      setError(
        `Ingrediente eliminado, pero algunos platos quedaron sin sincronizar: ${formatPostgrestError(
          primerError,
        )}`,
      );
    }
  };

  const opcionesRubro = RUBROS_INGREDIENTE.map((r) => ({
    valor: r,
    label: r,
  }));

  const secciones = RUBROS_INGREDIENTE.map((rubro) => {
    const lista = porRubro.get(rubro) ?? [];
    const visibles = buscando
      ? lista.filter((i) => normalizarBusqueda(i.nombre).includes(clave))
      : lista;
    return { rubro, lista, visibles };
  }).filter((s) => !buscando || s.visibles.length > 0);

  return (
    <Pantalla
      titulo="Ingredientes"
      subtitulo={
        isLoading
          ? "Cargando…"
          : !hasItems
            ? "Sin ingredientes"
            : agotados === 0
              ? `${ingredientes.length} ingredientes · todo disponible`
              : `${ingredientes.length} ingredientes · ${agotados} ${
                  agotados === 1 ? "agotado" : "agotados"
                }`
      }
      ayuda={
        <>
          <p>
            Lo que hay disponible para armar el menú. Cuando algo se acaba,
            apagá su interruptor y queda marcado como agotado.
          </p>
          <p>
            Las secciones arrancan cerradas: tocá el nombre del rubro para
            abrirla. Con el buscador encontrás un ingrediente sin abrir nada.
          </p>
          <p>
            Para cambiar el rubro o borrar un ingrediente, deslizá la fila hacia
            la izquierda. Al borrarlo también se quita de los platos que lo
            usaban.
          </p>
          <p>
            Esto no es el stock de compras: eso vive en{" "}
            <strong className="text-label">Stock</strong>.
          </p>
        </>
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

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : !hasItems ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<Shapes className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay ingredientes"
            texto="Agregá el primero abajo."
          />
        </div>
      ) : (
        <>
          {ingredientes.length > MINIMO_PARA_BUSCAR ? (
            <CampoBusqueda
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ingrediente"
              etiqueta="Buscar ingrediente"
            />
          ) : null}

          {secciones.length === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<Search className="h-6 w-6" aria-hidden />}
                titulo="Sin resultados"
                texto={`No hay ingredientes con «${busqueda.trim()}».`}
              />
            </div>
          ) : (
            secciones.map(({ rubro, lista, visibles }) => {
              const expandido = buscando || rubroExpandido[rubro];
              const listId = `rubro-list-${rubro.replace(/\//g, "-")}`;
              const agotadosRubro = lista.filter((i) => !i.disponible).length;

              return (
                <section key={rubro} className="mt-6">
                  <button
                    type="button"
                    aria-expanded={expandido}
                    aria-controls={listId}
                    disabled={buscando}
                    onClick={() => {
                      vibrar();
                      setRubroExpandido((prev) => ({
                        ...prev,
                        [rubro]: !prev[rubro],
                      }));
                    }}
                    className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-control px-1 text-left transition active:bg-fill disabled:active:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                      {rubro}{" "}
                      <span className="font-mono font-normal tabular-nums">
                        {buscando
                          ? `${visibles.length}/${lista.length}`
                          : lista.length}
                      </span>
                    </span>
                    {agotadosRubro > 0 && !expandido ? (
                      <span className="text-[0.82rem] text-danger">
                        {agotadosRubro}{" "}
                        {agotadosRubro === 1 ? "agotado" : "agotados"}
                      </span>
                    ) : null}
                    {buscando ? null : expandido ? (
                      <ChevronDown
                        className="h-[18px] w-[18px] shrink-0 text-label-3"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-[18px] w-[18px] shrink-0 text-label-3"
                        aria-hidden
                      />
                    )}
                  </button>

                  <div id={listId}>
                    {expandido ? (
                      visibles.length === 0 ? (
                        <p className="rounded-card bg-surface-3 px-4 py-3 text-[0.94rem] text-label-3">
                          Sin ingredientes en este rubro.
                        </p>
                      ) : (
                        <Lista>
                          {visibles.map((ingrediente) => (
                            <Fila
                              key={ingrediente.id}
                              titulo={
                                <span
                                  className={cx(
                                    !ingrediente.disponible && "text-label-2",
                                  )}
                                >
                                  {ingrediente.nombre}
                                </span>
                              }
                              detalle={
                                ingrediente.disponible ? undefined : (
                                  <span className="text-danger">Agotado</span>
                                )
                              }
                              chevron={false}
                              valor={
                                <Interruptor
                                  etiqueta={`${ingrediente.nombre} disponible`}
                                  activo={ingrediente.disponible}
                                  onChange={(v) =>
                                    void actualizarDisponibilidad(
                                      ingrediente.id,
                                      v,
                                    )
                                  }
                                />
                              }
                              acciones={[
                                {
                                  label: "Rubro",
                                  tono: "neutro",
                                  icono: (
                                    <Shapes className="h-5 w-5" aria-hidden />
                                  ),
                                  onClick: () => setCambiandoRubro(ingrediente),
                                },
                                {
                                  label: "Borrar",
                                  tono: "peligro",
                                  icono: (
                                    <Trash2 className="h-5 w-5" aria-hidden />
                                  ),
                                  onClick: () =>
                                    void eliminarIngrediente(ingrediente.id),
                                },
                              ]}
                            />
                          ))}
                        </Lista>
                      )
                    ) : null}
                  </div>
                </section>
              );
            })
          )}
        </>
      )}

      {!isLoading ? (
        <Seccion titulo="Agregar ingrediente" className="mt-8">
          <form
            onSubmit={agregarIngrediente}
            className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
          >
            <Campo
              aria-label="Nombre del ingrediente"
              value={nuevoIngrediente}
              onChange={(event) => setNuevoIngrediente(event.target.value)}
              placeholder="Nombre del ingrediente"
              enterKeyHint="done"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Selector
                titulo="Rubro"
                valor={nuevoRubro}
                opciones={opcionesRubro}
                onChange={(v) => setNuevoRubro(normalizarRubro(v))}
              />
              <Boton
                type="submit"
                cargando={isSubmitting}
                disabled={!nuevoIngrediente.trim()}
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                className="min-h-12"
              >
                Agregar
              </Boton>
            </div>
          </form>
        </Seccion>
      ) : null}

      <HojaOpciones
        abierta={cambiandoRubro !== null}
        onCerrar={() => setCambiandoRubro(null)}
        titulo={cambiandoRubro ? `Rubro de ${cambiandoRubro.nombre}` : "Rubro"}
        opciones={opcionesRubro}
        valor={cambiandoRubro?.rubro ?? null}
        onElegir={(v) => {
          if (cambiandoRubro && v !== cambiandoRubro.rubro) {
            void actualizarRubro(cambiandoRubro.id, normalizarRubro(v));
          }
        }}
      />
    </Pantalla>
  );
}
