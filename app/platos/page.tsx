"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Loader2,
  NotebookText,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import {
  Boton,
  BotonIcono,
  Campo,
  CampoBusqueda,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Hoja,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  cx,
  useAvisos,
} from "@/app/ui";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [ingredienteQuery, setIngredienteQuery] = useState("");
  const [isIngredienteDropdownOpen, setIsIngredienteDropdownOpen] =
    useState(false);
  const [ingredientesBorrador, setIngredientesBorrador] = useState<string[]>(
    [],
  );
  const [isUpdatingIngredientes, setIsUpdatingIngredientes] = useState(false);
  const [isAddingIngrediente, setIsAddingIngrediente] = useState(false);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const { confirmar } = useAvisos();

  const ingredientesPorId = useMemo(() => {
    return new Map(ingredientes.map((item) => [item.id, item]));
  }, [ingredientes]);

  const ingredientesOrdenados = useMemo(() => {
    return [...ingredientes].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [ingredientes]);

  const ingredientesFiltrados = useMemo(() => {
    const query = ingredienteQuery.trim().toLowerCase();
    if (!query) {
      return ingredientesOrdenados;
    }

    return ingredientesOrdenados.filter((ingrediente) =>
      ingrediente.nombre.toLowerCase().includes(query),
    );
  }, [ingredientesOrdenados, ingredienteQuery]);

  const ingredienteYaExiste = useMemo(() => {
    const query = ingredienteQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return ingredientesOrdenados.some(
      (ingrediente) => ingrediente.nombre.trim().toLowerCase() === query,
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
          .eq("tipo", "carta")
          .order("nombre", { ascending: true }),
      ]);

      if (ingredientesResponse.error) {
        setError(formatPostgrestError(ingredientesResponse.error));
        return;
      }

      if (platosResponse.error) {
        setError(formatPostgrestError(platosResponse.error));
        return;
      }

      setIngredientes((ingredientesResponse.data as Ingrediente[]) ?? []);
      setPlatos((platosResponse.data as Plato[]) ?? []);
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

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const toggleIngredienteBorrador = (ingredienteId: string) => {
    setIngredientesBorrador((actual) =>
      actual.includes(ingredienteId)
        ? actual.filter((id) => id !== ingredienteId)
        : [...actual, ingredienteId],
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
      setError(formatPostgrestError(updateError));
      setIsUpdatingIngredientes(false);
      return;
    }

    setPlatos((actual) =>
      actual.map((plato) =>
        plato.id === editingPlatoId ? (data as Plato) : plato,
      ),
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
      setError(formatPostgrestError(insertError));
      setIsAddingIngrediente(false);
      return;
    }

    const nuevoIngrediente = data as Ingrediente;
    setIngredientes((actual) => [...actual, nuevoIngrediente]);
    setIngredientesBorrador((actual) =>
      actual.includes(nuevoIngrediente.id)
        ? actual
        : [...actual, nuevoIngrediente.id],
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
      tipo: "carta",
      ingredientes_requeridos: [] as string[],
    };

    const { data, error: insertError } = await supabase
      .from("platos")
      .insert(payload)
      .select("id, nombre, categoria, ingredientes_requeridos")
      .single();

    if (insertError) {
      setError(formatPostgrestError(insertError));
      setIsSaving(false);
      return;
    }

    const nuevoPlato = data as Plato;
    setPlatos((actual) => [...actual, nuevoPlato]);
    setAltaAbierta(false);

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

  const eliminarPlato = async (plato: Plato) => {
    const ok = await confirmar({
      titulo: `¿Eliminar «${plato.nombre}»?`,
      texto: "Sale de la carta y no se puede deshacer.",
      confirmar: "Eliminar plato",
      peligro: true,
    });
    if (!ok) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("platos")
      .delete()
      .eq("id", plato.id);

    if (deleteError) {
      setError(formatPostgrestError(deleteError));
      setIsDeleting(false);
      return;
    }

    setPlatos((actual) => actual.filter((p) => p.id !== plato.id));

    if (editingPlatoId === plato.id) {
      setEditingPlatoId(null);
      setIngredientesSeleccionados([]);
      setIngredientesBorrador([]);
      setIngredienteQuery("");
      setIsIngredienteDropdownOpen(false);
    }

    setIsDeleting(false);
  };

  const estaDisponible = (plato: Plato) => {
    const requeridos = plato.ingredientes_requeridos ?? [];
    return requeridos.every((ingredienteId) => {
      const ingrediente = ingredientesPorId.get(ingredienteId);
      return ingrediente ? ingrediente.disponible : false;
    });
  };

  // Estables: Hoja vuelve a enfocar el panel cada vez que cambia onCerrar,
  // y eso le sacaría el foco al buscador de ingredientes al tipear.
  const cerrarAlta = useCallback(() => setAltaAbierta(false), []);
  const cerrarEdicion = useCallback(() => {
    setEditingPlatoId(null);
    setIngredientesSeleccionados([]);
    setIngredientesBorrador([]);
    setIngredienteQuery("");
    setIsIngredienteDropdownOpen(false);
  }, []);

  const platoEditando =
    platos.find((plato) => plato.id === editingPlatoId) ?? null;
  const agotados = platos.filter((plato) => !estaDisponible(plato)).length;

  const alerta = error ? (
    <div
      role="alert"
      className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
    >
      <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{error}</p>
    </div>
  ) : null;

  return (
    <Pantalla
      titulo="Platos"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${platos.length} ${platos.length === 1 ? "plato" : "platos"} de carta${
              agotados > 0
                ? ` · ${agotados} ${agotados === 1 ? "agotado" : "agotados"}`
                : ""
            }`
      }
      acciones={
        <BotonIcono
          etiqueta="Nuevo plato"
          icono={<Plus className="h-[22px] w-[22px]" aria-hidden />}
          onClick={() => setAltaAbierta(true)}
        />
      }
      ayuda={
        <>
          <p>
            Los platos de la carta y los ingredientes que necesita cada uno. Si
            alguno de esos ingredientes no está disponible, el plato figura como{" "}
            <strong className="text-label">Agotado</strong>.
          </p>
          <p>
            Tocá un plato para ver y elegir sus ingredientes o ir a su receta.
            Si un ingrediente no existe, se crea desde el mismo buscador.
          </p>
          <p>
            Con <strong className="text-label">+</strong> creás un plato nuevo.
            Para eliminar uno, deslizá la fila hacia la izquierda.
          </p>
        </>
      }
    >
      {editingPlatoId ? null : alerta}

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : platos.length === 0 ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<UtensilsCrossed className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay platos"
            texto="Creá el primero y después elegí sus ingredientes."
            accion={
              <Boton
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => setAltaAbierta(true)}
              >
                Nuevo plato
              </Boton>
            }
          />
        </div>
      ) : (
        platosPorCategoria.map((bloque) => (
          <Seccion
            key={bloque.categoria}
            titulo={`${bloque.categoria} · ${bloque.platos.length}`}
          >
            {bloque.platos.length === 0 ? (
              <p className="rounded-card bg-surface-3 px-4 py-3.5 text-[0.94rem] text-label-3">
                Sin platos en esta categoría.
              </p>
            ) : (
              <Lista>
                {bloque.platos.map((plato) => {
                  const disponible = estaDisponible(plato);
                  const ingredientesDelPlato = (
                    plato.ingredientes_requeridos ?? []
                  )
                    .map((id) => ingredientesPorId.get(id)?.nombre)
                    .filter(Boolean);

                  return (
                    <Fila
                      key={plato.id}
                      titulo={
                        <span className="font-medium">{plato.nombre}</span>
                      }
                      detalle={
                        ingredientesDelPlato.length > 0
                          ? ingredientesDelPlato.join(" · ")
                          : "Sin ingredientes asignados"
                      }
                      valor={
                        <Etiqueta tono={disponible ? "exito" : "alerta"}>
                          {disponible ? "Disponible" : "Agotado"}
                        </Etiqueta>
                      }
                      onClick={() => iniciarEdicion(plato)}
                      acciones={[
                        {
                          label: "Eliminar",
                          tono: "peligro",
                          icono: <Trash2 className="h-5 w-5" aria-hidden />,
                          onClick: () => void eliminarPlato(plato),
                        },
                      ]}
                    />
                  );
                })}
              </Lista>
            )}
          </Seccion>
        ))
      )}

      {/* Alta de plato */}
      <Hoja abierta={altaAbierta} onCerrar={cerrarAlta} titulo="Nuevo plato">
        <form onSubmit={guardarPlato} className="space-y-4 pt-1">
          {editingPlatoId ? null : alerta}
          <Campo
            label="Nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej. Tataki de atún"
            autoComplete="off"
            enterKeyHint="done"
          />
          <div>
            <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
              Categoría
            </p>
            <Segmentado<Categoria>
              etiqueta="Categoría"
              valor={categoria}
              onChange={setCategoria}
              opciones={CATEGORIAS.map((item) => ({
                valor: item,
                label: item,
              }))}
            />
          </div>
          <Boton
            type="submit"
            tamano="grande"
            ancho
            cargando={isSaving}
            disabled={!nombre.trim()}
            icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
          >
            Crear y elegir ingredientes
          </Boton>
        </form>
      </Hoja>

      {/* Detalle / edición de ingredientes del plato */}
      <Hoja
        abierta={platoEditando !== null}
        onCerrar={cerrarEdicion}
        titulo={platoEditando?.nombre}
        alto={isIngredienteDropdownOpen ? "alta" : "auto"}
      >
        {platoEditando ? (
          isIngredienteDropdownOpen ? (
            <div className="flex min-h-full flex-col">
              {alerta}
              <div className="sticky top-0 z-10 -mx-4 bg-surface-2 px-4 pb-2">
                <CampoBusqueda
                  value={ingredienteQuery}
                  onChange={(event) => setIngredienteQuery(event.target.value)}
                  placeholder="Buscar o crear ingrediente"
                  etiqueta="Buscar ingrediente"
                />
              </div>

              {ingredienteQuery.trim() && !ingredienteYaExiste ? (
                <button
                  type="button"
                  onClick={() => void agregarIngredienteDesdeDropdown()}
                  disabled={isAddingIngrediente}
                  className="mb-3 flex min-h-12 w-full items-center gap-2 rounded-card bg-surface-3 px-4 text-left text-[1rem] font-semibold text-accent transition active:bg-fill disabled:opacity-50"
                >
                  {isAddingIngrediente ? (
                    <Loader2
                      className="h-[18px] w-[18px] shrink-0 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 truncate">
                    Crear «{ingredienteQuery.trim()}»
                  </span>
                </button>
              ) : null}

              {ingredientesFiltrados.length > 0 ? (
                <ul
                  aria-label="Ingredientes"
                  className="overflow-hidden rounded-card bg-surface-3"
                >
                  {ingredientesFiltrados.map((ingrediente) => {
                    const selected = ingredientesBorrador.includes(
                      ingrediente.id,
                    );
                    return (
                      <li
                        key={ingrediente.id}
                        className="border-b border-separator last:border-0"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() =>
                            toggleIngredienteBorrador(ingrediente.id)
                          }
                          className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition active:bg-fill"
                        >
                          <span
                            aria-hidden
                            className={cx(
                              "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                              selected
                                ? "bg-accent text-on-accent"
                                : "border-2 border-fill-strong",
                            )}
                          >
                            {selected ? (
                              <Check className="h-4 w-4" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span
                            className={cx(
                              "min-w-0 flex-1 truncate text-[1rem]",
                              "text-label",
                              selected && "font-semibold",
                            )}
                          >
                            {ingrediente.nombre}
                          </span>
                          {!ingrediente.disponible ? (
                            <span className="shrink-0 text-[0.8rem] text-warning">
                              No disponible
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-1 py-6 text-center text-[0.94rem] text-label-3">
                  No se encontraron ingredientes.
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 -mb-[calc(env(safe-area-inset-bottom,0px)+1rem)] mt-auto grid grid-cols-[1fr_auto] gap-2 bg-surface-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
                <Boton
                  tamano="grande"
                  cargando={isUpdatingIngredientes}
                  icono={<Check className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => void confirmarSelectorIngredientes()}
                >
                  Guardar · {ingredientesBorrador.length}
                </Boton>
                <Boton
                  tamano="grande"
                  variante="secundario"
                  disabled={isUpdatingIngredientes}
                  onClick={cancelarSelectorIngredientes}
                >
                  Cancelar
                </Boton>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              {alerta}
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta>{platoEditando.categoria}</Etiqueta>
                <Etiqueta
                  tono={estaDisponible(platoEditando) ? "exito" : "alerta"}
                >
                  {estaDisponible(platoEditando) ? "Disponible" : "Agotado"}
                </Etiqueta>
              </div>

              <Seccion
                titulo={`Ingredientes · ${ingredientesSeleccionados.length}`}
                accion={
                  <Boton
                    variante="terciario"
                    tamano="chico"
                    className="min-h-11"
                    icono={<Pencil className="h-4 w-4" aria-hidden />}
                    onClick={abrirSelectorIngredientes}
                  >
                    Editar
                  </Boton>
                }
              >
                {ingredientesSeleccionados.length === 0 ? (
                  <button
                    type="button"
                    onClick={abrirSelectorIngredientes}
                    className="flex min-h-12 w-full items-center gap-2 rounded-card bg-surface-3 px-4 text-left text-[1rem] font-semibold text-accent transition active:bg-fill"
                  >
                    <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    Elegir ingredientes
                  </button>
                ) : (
                  <ul className="overflow-hidden rounded-card bg-surface-3">
                    {ingredientesSeleccionados.map((id) => {
                      const ingrediente = ingredientesPorId.get(id);
                      const ok = ingrediente ? ingrediente.disponible : false;
                      return (
                        <li
                          key={id}
                          className="flex min-h-12 items-center gap-3 border-b border-separator px-4 py-2 last:border-0"
                        >
                          <span className="min-w-0 flex-1 truncate text-[1rem] text-label">
                            {ingrediente?.nombre ?? "Ingrediente eliminado"}
                          </span>
                          {ok ? null : (
                            <span className="shrink-0 text-[0.84rem] font-medium text-warning">
                              No disponible
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Seccion>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link
                  href={`/receta?plato=${platoEditando.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-fill px-4 text-[0.97rem] font-semibold text-label transition hover:bg-fill-strong active:scale-[0.97]"
                >
                  <NotebookText className="h-[18px] w-[18px]" aria-hidden />
                  Receta
                </Link>
                <Boton
                  variante="peligro"
                  cargando={isDeleting}
                  icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => void eliminarPlato(platoEditando)}
                >
                  Eliminar
                </Boton>
              </div>
            </div>
          )
        ) : null}
      </Hoja>
    </Pantalla>
  );
}
