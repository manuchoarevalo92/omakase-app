"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useEffectEvent } from "react";
import {
  CircleAlert,
  CircleCheck,
  List,
  NotebookText,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  AreaTexto,
  Boton,
  BotonIcono,
  CampoBusqueda,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Interruptor,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  useAvisos,
} from "@/app/ui";

import {
  actualizarVinculoPreparacion,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  guardarRecetaPreparacion,
  type AreaProduccion,
  type Preparacion,
} from "@/src/lib/preparaciones";
import {
  fetchPlatosCartaParaRecetas,
  fetchRecetaPorPlatoId,
  fetchRecetasPlatos,
  guardarRecetaPlato,
  recetaDesdeCampos,
  recetaEstaCompleta,
  recetaTieneIngredientes,
  type PlatoCartaReceta,
  type RecetaPlato,
} from "@/src/lib/recetas";

type IngredienteReceta = {
  nombre: string;
  gramos: string;
};

type Filtro = "faltan" | "todas" | "completas";

type Seleccion =
  { origen: "prep"; id: string } | { origen: "plato"; id: string };

function encodeSeleccion(seleccion: Seleccion | null): string {
  if (!seleccion) {
    return "";
  }
  return seleccion.origen === "prep"
    ? `prep:${seleccion.id}`
    : `plato:${seleccion.id}`;
}

const filaVacia = (): IngredienteReceta => ({ nombre: "", gramos: "" });

function sumarGramosTotales(lista: IngredienteReceta[]): number {
  return lista.reduce((acc, fila) => {
    const nombre = fila.nombre.trim();
    const g = Number(String(fila.gramos).replace(",", ".").trim());
    if (!nombre || !(g > 0) || Number.isNaN(g)) {
      return acc;
    }
    return acc + g;
  }, 0);
}

export default function RecetaPage() {
  const [preps, setPreps] = useState<Preparacion[]>([]);
  const [platos, setPlatos] = useState<PlatoCartaReceta[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [ingredientes, setIngredientes] = useState<IngredienteReceta[]>([
    filaVacia(),
  ]);
  const [preparacion, setPreparacion] = useState("");
  const [preparacionGuardada, setPreparacionGuardada] = useState("");
  const [editandoPreparacion, setEditandoPreparacion] = useState(true);
  const [pax, setPax] = useState("");
  /** Última referencia usada para relación PAX ↔ gramos totales (se actualiza al recalcular o al cargar). */
  const [referenciaPax, setReferenciaPax] = useState<number | null>(null);
  const [referenciaGramosTotales, setReferenciaGramosTotales] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aviso } = useAvisos();
  const [recetasPlatos, setRecetasPlatos] = useState<Map<string, RecetaPlato>>(
    () => new Map(),
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("faltan");
  const [soloAdmin, setSoloAdmin] = useState(false);
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);

  const seleccionKey = encodeSeleccion(seleccion);
  const hayCatalogo = preps.length > 0 || platos.length > 0;

  const prepSeleccionada = useMemo(
    () =>
      seleccion?.origen === "prep"
        ? (preps.find((p) => p.id === seleccion.id) ?? null)
        : null,
    [preps, seleccion],
  );
  const platoSeleccionado = useMemo(
    () =>
      seleccion?.origen === "plato"
        ? (platos.find((p) => p.id === seleccion.id) ?? null)
        : null,
    [platos, seleccion],
  );

  const prepsPorArea = useMemo(() => {
    const grupos: { area: AreaProduccion; items: Preparacion[] }[] = [
      { area: "barra", items: [] },
      { area: "delivery", items: [] },
    ];
    for (const prep of preps) {
      const grupo = grupos.find((g) => g.area === prep.area) ?? grupos[1];
      grupo.items.push(prep);
    }
    return grupos.filter((g) => g.items.length > 0);
  }, [preps]);

  const paxNumero = useMemo(() => {
    const n = Number(String(pax).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }, [pax]);

  const formatearGramos = (valor: number) => {
    const redondeado = Math.round(valor * 10) / 10;
    return Number.isInteger(redondeado)
      ? String(redondeado)
      : redondeado.toFixed(1);
  };

  const formatearPax = (valor: number) => {
    const redondeado = Math.round(valor * 10) / 10;
    return Number.isInteger(redondeado)
      ? String(redondeado)
      : redondeado.toFixed(1);
  };

  const recalcularRendimiento = () => {
    setError(null);
    const G = sumarGramosTotales(ingredientes);
    if (G <= 0) {
      setError(
        "Necesitás al menos un ingrediente con nombre y gramos para recalcular el PAX.",
      );
      return;
    }

    if (
      referenciaPax != null &&
      referenciaPax > 0 &&
      referenciaGramosTotales != null &&
      referenciaGramosTotales > 0
    ) {
      const nuevoPax = referenciaPax * (G / referenciaGramosTotales);
      const limpio = Math.max(0.1, Math.round(nuevoPax * 10) / 10);
      setPax(formatearPax(limpio));
      setReferenciaPax(limpio);
      setReferenciaGramosTotales(G);
      aviso("PAX recalculado según el peso total de ingredientes.");
      return;
    }

    if (paxNumero == null) {
      setError(
        "Indicá primero cuánto rinden esas cantidades (PAX inicial) y completá los gramos.",
      );
      return;
    }

    setReferenciaPax(paxNumero);
    setReferenciaGramosTotales(G);
    aviso(
      "Referencia lista: PAX y gramos totales guardados. Volvé a usar este botón cuando cambie el peso total.",
    );
  };

  const recalcularIngredientes = () => {
    setError(null);
    const G = sumarGramosTotales(ingredientes);

    if (paxNumero == null) {
      setError(
        "Indicá el PAX (cuántos querés servir) para escalar las cantidades.",
      );
      return;
    }

    if (
      referenciaPax == null ||
      referenciaPax <= 0 ||
      referenciaGramosTotales == null ||
      referenciaGramosTotales <= 0
    ) {
      if (G > 0) {
        setReferenciaPax(paxNumero);
        setReferenciaGramosTotales(G);
        aviso(
          "Referencia fijada con el PAX y los gramos actuales. Ajustá el PAX y tocá de nuevo para escalar.",
        );
      } else {
        setError(
          "Completá ingredientes con gramos o usá antes «Recalcular rendimiento».",
        );
      }
      return;
    }

    const factor = paxNumero / referenciaPax;
    setIngredientes((actual) =>
      actual.map((fila) => {
        if (!fila.gramos.trim()) {
          return fila;
        }
        const g = Number(fila.gramos.replace(",", ".").trim());
        if (!(g > 0) || Number.isNaN(g)) {
          return fila;
        }
        return { ...fila, gramos: formatearGramos(g * factor) };
      }),
    );

    const gramosNuevosTotales = referenciaGramosTotales * factor;
    setReferenciaPax(paxNumero);
    setReferenciaGramosTotales(Math.round(gramosNuevosTotales * 10) / 10);
    aviso("Gramos recalculados según el PAX indicado.");
  };

  const aplicarContenido = (contenido: {
    ingredientes: { nombre?: string; gramos?: string | number }[];
    pasos: string;
    pax: number | null;
  }) => {
    const normalizados = contenido.ingredientes.map((item) => ({
      nombre: item.nombre ?? "",
      gramos:
        typeof item.gramos === "number"
          ? String(item.gramos)
          : ((item.gramos as string) ?? ""),
    }));
    setIngredientes(normalizados.length > 0 ? normalizados : [filaVacia()]);
    setPreparacion(contenido.pasos);
    setPreparacionGuardada(contenido.pasos);
    setEditandoPreparacion(contenido.pasos.trim().length === 0);
    setPax(contenido.pax != null ? String(contenido.pax) : "");
    const totalG = sumarGramosTotales(normalizados);
    if (contenido.pax != null && totalG > 0) {
      setReferenciaPax(contenido.pax);
      setReferenciaGramosTotales(totalG);
    } else {
      setReferenciaPax(contenido.pax);
      setReferenciaGramosTotales(totalG > 0 ? totalG : null);
    }
  };

  const cargarLista = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listaPreps, listaPlatos, mapaRecetas] = await Promise.all([
        fetchPreparaciones(),
        fetchPlatosCartaParaRecetas(),
        fetchRecetasPlatos().catch(() => new Map<string, RecetaPlato>()),
      ]);
      setPreps(listaPreps);
      setPlatos(listaPlatos);
      setRecetasPlatos(mapaRecetas);
      const params = new URLSearchParams(window.location.search);
      const prepUrl = params.get("prep");
      const platoUrl = params.get("plato");
      if (prepUrl && listaPreps.some((p) => p.id === prepUrl)) {
        setSeleccion({ origen: "prep", id: prepUrl });
      } else if (platoUrl && listaPlatos.some((p) => p.id === platoUrl)) {
        setSeleccion({ origen: "plato", id: platoUrl });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cargarReceta = async (actual: Seleccion | null) => {
    if (!actual) {
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      setSoloAdmin(false);
      return;
    }

    setError(null);

    if (actual.origen === "plato") {
      setSoloAdmin(false);
      try {
        const receta = await fetchRecetaPorPlatoId(actual.id);
        if (receta) {
          aplicarContenido(receta);
          return;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar la receta.",
        );
        return;
      }
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      return;
    }

    const prep = preps.find((p) => p.id === actual.id);
    if (!prep) {
      return;
    }

    setSoloAdmin(prep.recetaSoloAdmin);
    const propia = recetaDesdeCampos({
      ingredientes: prep.recetaIngredientes,
      pasos: prep.proceso,
      pax: prep.recetaPax,
    });
    if (recetaTieneIngredientes(propia) || propia.pasos) {
      aplicarContenido(propia);
      return;
    }

    if (!prep.recetaPlatoId) {
      aplicarContenido({ ingredientes: [], pasos: "", pax: null });
      return;
    }

    try {
      const heredada = await fetchRecetaPorPlatoId(prep.recetaPlatoId);
      if (heredada) {
        aplicarContenido(heredada);
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar la receta.",
      );
      return;
    }
    aplicarContenido({ ingredientes: [], pasos: "", pax: null });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarLista();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // El botón «atrás» del teléfono vuelve del editor a la lista.
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const prepUrl = params.get("prep");
      const platoUrl = params.get("plato");
      setSeleccion(
        prepUrl
          ? { origen: "prep", id: prepUrl }
          : platoUrl
            ? { origen: "plato", id: platoUrl }
            : null,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const elegir = (nueva: Seleccion | null) => {
    setError(null);
    setSeleccion(nueva);
    const url = nueva
      ? `?${nueva.origen}=${nueva.id}`
      : window.location.pathname;
    if (nueva) {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
    window.scrollTo({ top: 0 });
  };

  // Carga la receta cada vez que cambia el ítem elegido.
  const cargarSeleccion = useEffectEvent(() => {
    void cargarReceta(seleccion);
  });

  useEffect(() => {
    const timer = window.setTimeout(cargarSeleccion, 0);
    return () => window.clearTimeout(timer);
  }, [seleccionKey]);

  const actualizarIngrediente = (
    index: number,
    patch: Partial<IngredienteReceta>,
  ) => {
    setIngredientes((actual) =>
      actual.map((fila, i) => (i === index ? { ...fila, ...patch } : fila)),
    );
  };

  const agregarFilaIngrediente = () => {
    setIngredientes((actual) => [...actual, filaVacia()]);
  };

  const quitarFilaIngrediente = (index: number) => {
    setIngredientes((actual) =>
      actual.length <= 1 ? [filaVacia()] : actual.filter((_, i) => i !== index),
    );
  };

  const guardar = async (): Promise<boolean> => {
    if (!seleccion) {
      setError("Seleccioná un ítem de Tiempos Prep o un plato.");
      return false;
    }

    if (seleccion.origen === "plato" && paxNumero === null) {
      setError("Indicá el rendimiento en PAX (número mayor que 0).");
      aviso("Falta el PAX: cuántas porciones rinde.", { tono: "error" });
      return false;
    }

    const ingredientesPayload = ingredientes
      .map((fila) => ({
        nombre: fila.nombre.trim(),
        gramosRaw: fila.gramos.trim(),
      }))
      .filter((fila) => fila.nombre.length > 0);

    for (const fila of ingredientesPayload) {
      if (fila.gramosRaw === "") {
        setError(`Indica los gramos para: ${fila.nombre}`);
        aviso(`Faltan los gramos de ${fila.nombre}.`, { tono: "error" });
        return false;
      }
      const gramos = Number(fila.gramosRaw.replace(",", "."));
      if (Number.isNaN(gramos) || gramos < 0) {
        setError("Revisa los gramos: deben ser números válidos.");
        aviso("Revisá los gramos: tienen que ser números.", { tono: "error" });
        return false;
      }
    }

    setIsSaving(true);
    setError(null);

    const ingredientesGuardar = ingredientesPayload.map((fila) => ({
      nombre: fila.nombre,
      gramos: Number(fila.gramosRaw.replace(",", ".")),
    }));
    const paxGuardar = paxNumero != null ? Math.round(paxNumero) : null;

    try {
      if (seleccion.origen === "prep") {
        const actualizada = await guardarRecetaPreparacion(seleccion.id, {
          pax: paxGuardar,
          ingredientes: ingredientesGuardar,
          proceso: preparacion.trim(),
        });
        setPreps((actual) =>
          actual.map((p) => (p.id === actualizada.id ? actualizada : p)),
        );
        aviso(`Receta guardada para ${actualizada.nombre}.`);
      } else {
        await guardarRecetaPlato({
          platoId: seleccion.id,
          ingredientes: ingredientesGuardar,
          pasos: preparacion.trim(),
          pax: paxGuardar,
        });
        const platoId = seleccion.id;
        setRecetasPlatos((actual) => {
          const next = new Map(actual);
          next.set(platoId, {
            platoId,
            ingredientes: ingredientesGuardar,
            pasos: preparacion.trim(),
            pax: paxGuardar,
          });
          return next;
        });
        aviso(
          `Receta guardada para ${platoSeleccionado?.nombre ?? "el plato"}.`,
        );
      }
      setPreparacionGuardada(preparacion.trim());
      setEditandoPreparacion(preparacion.trim().length === 0);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la receta.",
      );
      aviso("No se pudo guardar la receta.", { tono: "error" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const guardarSoloAdmin = async (valor: boolean) => {
    if (seleccion?.origen !== "prep") {
      return;
    }
    setSoloAdmin(valor);
    setGuardandoAcceso(true);
    try {
      const actualizada = await actualizarVinculoPreparacion(seleccion.id, {
        recetaSoloAdmin: valor,
      });
      setPreps((actual) =>
        actual.map((p) => (p.id === actualizada.id ? actualizada : p)),
      );
    } catch (err) {
      setSoloAdmin(!valor);
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el acceso.",
      );
    } finally {
      setGuardandoAcceso(false);
    }
  };

  /** Estado de cada ítem para la lista: completa, a medias, vacía o heredada de un plato. */
  const estadoDe = (item: Seleccion): EstadoReceta => {
    if (item.origen === "plato") {
      const r = recetasPlatos.get(item.id);
      if (!r) return "vacia";
      return recetaEstaCompleta(r)
        ? "completa"
        : recetaTieneIngredientes(r) || r.pasos
          ? "parcial"
          : "vacia";
    }
    const prep = preps.find((p) => p.id === item.id);
    if (!prep) return "vacia";
    const propia = recetaDesdeCampos({
      ingredientes: prep.recetaIngredientes,
      pasos: prep.proceso,
      pax: prep.recetaPax,
    });
    if (recetaEstaCompleta(propia)) return "completa";
    if (recetaTieneIngredientes(propia) || propia.pasos) return "parcial";
    if (prep.recetaPlatoId) {
      const r = recetasPlatos.get(prep.recetaPlatoId);
      if (r && (recetaTieneIngredientes(r) || r.pasos)) return "heredada";
    }
    return "vacia";
  };

  const catalogo = useMemo(() => {
    const grupos: {
      titulo: string;
      items: { sel: Seleccion; nombre: string }[];
    }[] = [
      ...prepsPorArea.map((g) => ({
        titulo: `Tiempos Prep · ${ETIQUETA_AREA_PRODUCCION[g.area]}`,
        items: g.items.map((p) => ({
          sel: { origen: "prep" as const, id: p.id },
          nombre: p.nombre,
        })),
      })),
      {
        titulo: "Platos",
        items: platos.map((p) => ({
          sel: { origen: "plato" as const, id: p.id },
          nombre: p.nombre,
        })),
      },
    ];
    return grupos.filter((g) => g.items.length > 0);
  }, [prepsPorArea, platos]);

  const todos = catalogo.flatMap((g) => g.items);
  const listos = todos.filter((i) => {
    const e = estadoDe(i.sel);
    return e === "completa" || e === "heredada";
  }).length;

  const gruposVisibles = catalogo
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        const e = estadoDe(i.sel);
        if (filtro === "faltan" && (e === "completa" || e === "heredada"))
          return false;
        if (filtro === "completas" && !(e === "completa" || e === "heredada"))
          return false;
        const q = normalizarTexto(busqueda);
        return !q || normalizarTexto(i.nombre).includes(q);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const nombreSeleccion =
    prepSeleccionada?.nombre ?? platoSeleccionado?.nombre ?? "";
  const estadoActual = seleccion ? estadoDe(seleccion) : "vacia";
  const siguienteQueFalta = (() => {
    if (!seleccion) return null;
    const idx = todos.findIndex((i) => encodeSeleccion(i.sel) === seleccionKey);
    const resto = [
      ...todos.slice(idx + 1),
      ...todos.slice(0, Math.max(0, idx)),
    ];
    return (
      resto.find((i) => {
        const e = estadoDe(i.sel);
        return e === "vacia" || e === "parcial";
      }) ?? null
    );
  })();

  const gramosPorPax = (gramos: string) => {
    if (!paxNumero || !gramos.trim()) return "—";
    const g = Number(gramos.replace(",", ".").trim());
    if (!(g > 0) || Number.isNaN(g)) return "—";
    return (g / paxNumero).toFixed(1);
  };

  return (
    <Pantalla
      titulo={seleccion ? nombreSeleccion || "Receta" : "Recetas"}
      subtitulo={
        seleccion
          ? seleccion.origen === "plato"
            ? "Plato de la carta"
            : `Tiempos Prep · ${prepSeleccionada ? ETIQUETA_AREA_PRODUCCION[prepSeleccionada.area] : ""}`
          : isLoading
            ? "Cargando…"
            : "Recetas y procesos de cocina"
      }
      acciones={
        seleccion ? (
          <BotonIcono
            etiqueta="Volver a la lista"
            icono={<List className="h-[22px] w-[22px]" aria-hidden />}
            onClick={() => elegir(null)}
          />
        ) : undefined
      }
      ayuda={
        <>
          <p>
            Hay dos orígenes: lo que se agrega en{" "}
            <Link href="/produccion-tiempos" className="text-accent underline">
              Tiempos Prep
            </Link>{" "}
            (procesos de cocina) y los platos de la carta, que se crean en{" "}
            <Link href="/platos" className="text-accent underline">
              Platos
            </Link>
            . Acá se carga la receta de cada uno.
          </p>
          <p>
            <strong className="text-label">Rendimiento</strong>: cuántas
            porciones (PAX) rinden los gramos cargados. Si cambiás los gramos,
            «Recalcular PAX» actualiza el rendimiento; si cambiás el PAX,
            «Escalar gramos» ajusta todos los ingredientes en la misma
            proporción.
          </p>
          <p>
            «De plato» significa que el proceso de Tiempos Prep usa la receta
            del plato vinculado mientras no tenga una propia.
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
        <EsqueletoLista filas={7} />
      ) : !hayCatalogo ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<NotebookText className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay ítems"
            texto="Agregá una preparación en Tiempos Prep o un plato en Platos, y después volvé a cargar la receta."
          />
        </div>
      ) : !seleccion ? (
        <>
          <div className="rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <p className="text-[0.94rem] text-label-2">
              <span className="font-semibold tabular-nums text-label">
                {listos}/{todos.length}
              </span>{" "}
              con receta
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{
                  width: `${todos.length ? (listos / todos.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <CampoBusqueda
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar receta"
              etiqueta="Buscar receta"
            />
            <Segmentado<Filtro>
              etiqueta="Mostrar"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: "faltan", label: "Faltan" },
                { valor: "todas", label: "Todas" },
                { valor: "completas", label: "Listas" },
              ]}
            />
          </div>
          {gruposVisibles.length === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<CircleCheck className="h-6 w-6" aria-hidden />}
                titulo={
                  filtro === "faltan" && !busqueda
                    ? "No falta ninguna"
                    : "Sin resultados"
                }
                texto={
                  filtro === "faltan" && !busqueda
                    ? "Todas las recetas tienen ingredientes y preparación."
                    : undefined
                }
              />
            </div>
          ) : (
            gruposVisibles.map((g) => (
              <Seccion
                key={g.titulo}
                titulo={`${g.titulo} · ${g.items.length}`}
              >
                <Lista>
                  {g.items.map((i) => (
                    <Fila
                      key={encodeSeleccion(i.sel)}
                      titulo={i.nombre}
                      valor={<EtiquetaEstado estado={estadoDe(i.sel)} />}
                      onClick={() => elegir(i.sel)}
                    />
                  ))}
                </Lista>
              </Seccion>
            ))
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaEstado estado={estadoActual} />
            {prepSeleccionada ? (
              <label className="ml-auto flex min-h-11 items-center gap-3 text-[0.9rem] text-label-2">
                Solo Manu la ve en el plan
                <Interruptor
                  etiqueta="Solo Manu la ve en el plan"
                  activo={soloAdmin}
                  onChange={(v) => {
                    if (!guardandoAcceso) void guardarSoloAdmin(v);
                  }}
                />
              </label>
            ) : null}
          </div>

          <Seccion
            titulo="Rendimiento"
            pie={
              referenciaPax != null && referenciaGramosTotales != null
                ? `Referencia: ${referenciaPax} PAX · ${referenciaGramosTotales} g en total.`
                : seleccion.origen === "plato"
                  ? "Obligatorio en platos: cuántas porciones rinden los gramos."
                  : "Opcional: cuántas porciones rinde la receta."
            }
          >
            <div className="flex items-center gap-2 rounded-card bg-surface-3 p-2 pl-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <label
                htmlFor="receta-pax"
                className="flex-1 text-[1rem] text-label"
              >
                PAX
              </label>
              <input
                id="receta-pax"
                type="text"
                inputMode="decimal"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="10"
                className="h-11 w-20 rounded-[0.65rem] bg-fill text-center font-mono text-[1.05rem] tabular-nums text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2"
              />
              <Boton
                variante="secundario"
                tamano="chico"
                className="min-h-11"
                onClick={recalcularRendimiento}
              >
                Recalcular PAX
              </Boton>
            </div>
          </Seccion>

          <Seccion
            titulo="Ingredientes"
            accion={
              <Boton
                variante="terciario"
                tamano="chico"
                onClick={recalcularIngredientes}
              >
                Escalar gramos
              </Boton>
            }
          >
            <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <li className="flex items-center gap-2 border-b border-separator py-2 pl-4 pr-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-label-3">
                <span className="flex-1">Ingrediente</span>
                <span className="w-[4.25rem] text-center">g</span>
                <span className="w-11 text-center">g/PAX</span>
                <span className="w-11" aria-hidden />
              </li>
              {ingredientes.map((fila, index) => (
                <li
                  key={index}
                  className="flex min-h-14 items-center gap-2 border-b border-separator py-1.5 pl-4 pr-2 last:border-0"
                >
                  <textarea
                    rows={1}
                    value={fila.nombre}
                    onChange={(e) =>
                      actualizarIngrediente(index, { nombre: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    ref={ajustarAlto}
                    onInput={(e) => ajustarAlto(e.currentTarget)}
                    placeholder="Ingrediente"
                    enterKeyHint="next"
                    aria-label={`Ingrediente ${index + 1}`}
                    className="min-w-0 flex-1 resize-none bg-transparent py-2 text-[1rem] leading-snug text-label outline-none placeholder:text-label-3"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fila.gramos}
                    onChange={(e) =>
                      actualizarIngrediente(index, { gramos: e.target.value })
                    }
                    placeholder="0"
                    aria-label={`Gramos de ${fila.nombre || `ingrediente ${index + 1}`}`}
                    className="h-11 w-[4.25rem] shrink-0 rounded-[0.65rem] bg-fill text-center font-mono text-[1rem] tabular-nums text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2"
                  />
                  <span
                    className="w-11 shrink-0 text-center font-mono text-[0.8rem] tabular-nums text-label-3"
                    title="Gramos por porción"
                  >
                    {gramosPorPax(fila.gramos)}
                  </span>
                  <BotonIcono
                    etiqueta="Quitar ingrediente"
                    variante="plano"
                    icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
                    onClick={() => quitarFilaIngrediente(index)}
                    className="text-label-3 hover:text-danger"
                  />
                </li>
              ))}
            </ul>
            <Boton
              variante="terciario"
              className="mt-2"
              icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
              onClick={agregarFilaIngrediente}
            >
              Añadir ingrediente
            </Boton>
          </Seccion>

          <Seccion
            titulo="Preparación"
            accion={
              preparacionGuardada.trim().length > 0 ? (
                <Boton
                  variante="terciario"
                  tamano="chico"
                  icono={
                    editandoPreparacion ? undefined : (
                      <Pencil className="h-4 w-4" aria-hidden />
                    )
                  }
                  onClick={() => {
                    if (editandoPreparacion) {
                      setPreparacion(preparacionGuardada);
                      setEditandoPreparacion(false);
                    } else {
                      setEditandoPreparacion(true);
                    }
                  }}
                >
                  {editandoPreparacion ? "Cancelar" : "Editar"}
                </Boton>
              ) : undefined
            }
          >
            {editandoPreparacion ? (
              <AreaTexto
                aria-label="Preparación"
                value={preparacion}
                onChange={(e) => setPreparacion(e.target.value)}
                rows={10}
                placeholder={"1. Pasos, tiempos y temperaturas…\n2. …"}
                className="min-h-56 resize-y bg-surface-3"
              />
            ) : (
              <article className="whitespace-pre-wrap rounded-card bg-surface-3 px-4 py-3 text-[1rem] leading-relaxed text-label shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                {preparacionGuardada}
              </article>
            )}
          </Seccion>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 -mx-4 mt-6 grid grid-cols-2 gap-2 px-4 pb-1 sm:bottom-4 sm:mx-0 sm:px-0">
            <Boton
              tamano="grande"
              cargando={isSaving}
              icono={<Save className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => void guardar()}
              className="shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
            >
              Guardar
            </Boton>
            {siguienteQueFalta ? (
              <Boton
                tamano="grande"
                variante="secundario"
                disabled={isSaving}
                onClick={async () => {
                  const ok = await guardar();
                  if (ok) elegir(siguienteQueFalta.sel);
                }}
                className="bg-surface-3 shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
                aria-label={`Guardar y pasar a ${siguienteQueFalta.nombre}`}
                title={`Guardar y pasar a ${siguienteQueFalta.nombre}`}
              >
                <span className="whitespace-nowrap">Guardar y seguir</span>
              </Boton>
            ) : null}
          </div>
        </>
      )}
    </Pantalla>
  );
}

/** Textarea de una línea que crece si el nombre del ingrediente es largo. */
function ajustarAlto(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

type EstadoReceta = "completa" | "parcial" | "vacia" | "heredada";

function EtiquetaEstado(props: { estado: EstadoReceta }) {
  switch (props.estado) {
    case "completa":
      return <Etiqueta tono="exito">Lista</Etiqueta>;
    case "parcial":
      return <Etiqueta tono="alerta">A medias</Etiqueta>;
    case "heredada":
      return <Etiqueta tono="info">De plato</Etiqueta>;
    default:
      return <Etiqueta>Falta</Etiqueta>;
  }
}

function normalizarTexto(t: string): string {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
