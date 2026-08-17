"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, FilePlus, List, Loader2, Lock, Pencil } from "lucide-react";

import { MenuGuardadoSecciones } from "@/app/components/menu-guardado-secciones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  MENU_GUARDADO_NIGIRI,
  MENU_GUARDADO_OTSUMAMI,
  MENU_GUARDADO_POSTRE,
  partesDesdeMenuOmakaseGuardado,
} from "@/src/lib/menu-omakase-guardado";
import { supabase } from "@/src/lib/supabase";

type Categoria = "Otsumami" | "Nigiri" | "Postre" | "Extensión";
type Servicio = "Mediodia" | "Noche";

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

type HistorialPayload = {
  fecha: string;
  hora: string;
  servicio: Servicio;
  menu_omakase: string[];
  extensiones: string[];
};

type RegistroHistorialRow = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: Servicio | null;
  menu_omakase: string[] | null;
  extensiones: string[] | null;
};

type ResumenServicio = {
  fecha: string;
  hora: string;
  servicio: Servicio;
  menuTipo: "Clasico" | "Nigiri only";
  otsumamiBase: string[];
  nigiri: string[];
  postre: string[];
  regalo: string[];
  extensiones: string[];
};

const CATEGORIAS_OMAKASE: Categoria[] = ["Otsumami", "Nigiri", "Postre"];
const TOTAL_ITEMS_OMAKASE_CLASICO = 17;
const OTSUMAMI_BASE = 4;
const OTSUMAMI_REGALO = 2;
const NIGIRI_BASE = 12;
const POSTRE_BASE = 1;
const EXTENSION_SLOTS = 5;
const CATEGORIAS_EXTRAS: Categoria[] = ["Otsumami", "Nigiri", "Extensión"];

function formatFechaLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function horaLocalHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function rellenarIdsPorSlot(ids: string[], total: number): string[] {
  const out = ids.slice();
  while (out.length < total) {
    out.push("");
  }
  return out.slice(0, total);
}

function minutosHistoriaHora(h: string | null): number {
  if (!h?.trim()) {
    return -1;
  }
  const parts = h.trim().split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return -1;
  }
  return hh * 60 + mm;
}

/** Último servicio cerrado primero (fecha ISO desc, hora desc, id). */
function compararHistorialMasReciente(a: RegistroHistorialRow, b: RegistroHistorialRow): number {
  const df = b.fecha.localeCompare(a.fecha);
  if (df !== 0) {
    return df;
  }
  const ma = minutosHistoriaHora(a.hora);
  const mb = minutosHistoriaHora(b.hora);
  if (ma !== mb) {
    return mb - ma;
  }
  return b.id.localeCompare(a.id);
}

function registroMasRecienteEnHistorial(
  rows: RegistroHistorialRow[]
): RegistroHistorialRow | null {
  if (!rows.length) {
    return null;
  }
  return [...rows].sort(compararHistorialMasReciente)[0] ?? null;
}

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
  const [fechaServicio, setFechaServicio] = useState(() => formatFechaLocalYYYYMMDD(now));
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
  /** Con menú del día activo: true = sólo visualización arriba; false = formulario de edición visible. */
  const [editorOcultoTrasGuardar, setEditorOcultoTrasGuardar] = useState(false);
  const [menuNigiriOnly, setMenuNigiriOnly] = useState(false);

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
    if (menuNigiriOnly) {
      return omakaseNigiri.filter((id) => id.trim().length > 0).length;
    }
    return [
      ...omakaseOtsumami,
      ...omakaseNigiri,
      ...omakasePostre,
    ].filter((id) => id.trim().length > 0).length;
  }, [menuNigiriOnly, omakaseNigiri, omakaseOtsumami, omakasePostre]);

  const totalPasosBaseObjetivo = menuNigiriOnly ? NIGIRI_BASE : TOTAL_ITEMS_OMAKASE_CLASICO;

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

  /** Platos ya elegidos en el menú servido; no deben poder repetirse en los extras. */
  const idsEnMenuSeleccionado = useMemo(() => {
    const ids = menuNigiriOnly
      ? omakaseNigiri
      : [
          ...omakaseOtsumami,
          ...omakaseOtsumamiRegalo,
          ...omakaseNigiri,
          ...omakasePostre,
        ];
    return new Set(ids.filter((id) => id.trim().length > 0));
  }, [
    menuNigiriOnly,
    omakaseOtsumami,
    omakaseOtsumamiRegalo,
    omakaseNigiri,
    omakasePostre,
  ]);

  const resumenDerivadoDelFormulario = useMemo((): ResumenServicio => {
    return {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      menuTipo: menuNigiriOnly ? "Nigiri only" : "Clasico",
      otsumamiBase: menuNigiriOnly ? [] : omakaseOtsumami.filter((id) => id.trim().length > 0),
      nigiri: omakaseNigiri.filter((id) => id.trim().length > 0),
      postre: menuNigiriOnly ? [] : omakasePostre.filter((id) => id.trim().length > 0),
      regalo: menuNigiriOnly ? [] : omakaseOtsumamiRegalo.filter((id) => id.trim().length > 0),
      extensiones: extensionSlots.filter((id) => id.trim().length > 0),
    };
  }, [
    fechaServicio,
    horaServicio,
    servicio,
    menuNigiriOnly,
    omakaseOtsumami,
    omakaseNigiri,
    omakasePostre,
    omakaseOtsumamiRegalo,
    extensionSlots,
  ]);

  const hidratarFormularioDesdeRegistroHistorial = (
    elegido: RegistroHistorialRow,
    servicioFallback: Servicio
  ): void => {
    const idsSinVacios = (elegido.menu_omakase ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    const minPlatosClasico =
      MENU_GUARDADO_OTSUMAMI + MENU_GUARDADO_NIGIRI + MENU_GUARDADO_POSTRE;
    const maxPlatosClasico = minPlatosClasico + OTSUMAMI_REGALO;

    const esNigiriOnly = idsSinVacios.length === MENU_GUARDADO_NIGIRI;
    const esClasicoValido =
      idsSinVacios.length >= minPlatosClasico && idsSinVacios.length <= maxPlatosClasico;

    if (!esNigiriOnly && !esClasicoValido) {
      return;
    }

    const refDate = new Date();
    const horaEtiqueta = elegido.hora?.trim() ? elegido.hora : horaLocalHHmm(refDate);
    const servicioRow: Servicio =
      elegido.servicio === "Mediodia" || elegido.servicio === "Noche"
        ? elegido.servicio
        : servicioFallback;

    let otsBase: string[];
    let nig: string[];
    let post: string[];
    let rega: string[];

    if (esNigiriOnly) {
      setMenuNigiriOnly(true);
      otsBase = Array.from({ length: OTSUMAMI_BASE }, () => "");
      nig = rellenarIdsPorSlot(idsSinVacios, NIGIRI_BASE);
      post = Array.from({ length: POSTRE_BASE }, () => "");
      rega = Array.from({ length: OTSUMAMI_REGALO }, () => "");
      setOmakaseOtsumami(otsBase);
      setOmakaseNigiri(nig);
      setOmakasePostre(post);
      setOmakaseOtsumamiRegalo(rega);
    } else {
      setMenuNigiriOnly(false);
      const partes = partesDesdeMenuOmakaseGuardado(idsSinVacios);
      otsBase = rellenarIdsPorSlot(partes.otsumami, OTSUMAMI_BASE);
      nig = rellenarIdsPorSlot(partes.nigiri, NIGIRI_BASE);
      post = rellenarIdsPorSlot(partes.postre, POSTRE_BASE);
      rega = rellenarIdsPorSlot(partes.regalo, OTSUMAMI_REGALO);
      setOmakaseOtsumami(otsBase);
      setOmakaseNigiri(nig);
      setOmakasePostre(post);
      setOmakaseOtsumamiRegalo(rega);
    }

    const ext = (elegido.extensiones ?? []).map(String).filter((id) => id.trim());
    setExtensionSlots(rellenarIdsPorSlot(ext, EXTENSION_SLOTS));
    setFechaServicio(elegido.fecha);
    setHoraServicio(horaEtiqueta);
    setServicio(servicioRow);

    const resumenArmado: ResumenServicio = esNigiriOnly
      ? {
          fecha: elegido.fecha,
          hora: horaEtiqueta,
          servicio: servicioRow,
          menuTipo: "Nigiri only",
          otsumamiBase: [],
          nigiri: nig.filter((id) => id.trim().length > 0),
          postre: [],
          regalo: [],
          extensiones: ext,
        }
      : {
          fecha: elegido.fecha,
          hora: horaEtiqueta,
          servicio: servicioRow,
          menuTipo: "Clasico",
          otsumamiBase: otsBase.filter((id) => id.trim().length > 0),
          nigiri: nig.filter((id) => id.trim().length > 0),
          postre: post.filter((id) => id.trim().length > 0),
          regalo: rega.filter((id) => id.trim().length > 0),
          extensiones: ext,
        };

    setResumenServicio(resumenArmado);
    setEditorOcultoTrasGuardar(true);
    setSuccess(
      `Último menú del historial cargado (${elegido.fecha} · ${servicioRow}${horaEtiqueta ? ` · ${horaEtiqueta}` : ""}). Tocá Editar menú para modificarlo o guardalo de nuevo.`
    );
    setError(null);
  };

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const servicioFallbackInicial: Servicio =
        new Date().getHours() < 17 ? "Mediodia" : "Noche";

      const [ingredientesResponse, platosResponse, historialResponse] =
        await Promise.all([
          supabase
            .from("ingredientes")
            .select("id, nombre, disponible, rubro")
            .order("nombre", { ascending: true }),
          supabase
            .from("platos")
            .select("id, nombre, categoria, ingredientes_requeridos")
            .eq("tipo", "carta")
            .order("nombre", { ascending: true }),
          supabase
            .from("historial_servicios")
            .select("id, fecha, hora, servicio, menu_omakase, extensiones")
            .order("fecha", { ascending: false })
            .limit(120),
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

      if (!historialResponse.error && historialResponse.data?.length) {
        const elegido = registroMasRecienteEnHistorial(
          historialResponse.data as RegistroHistorialRow[]
        );
        if (elegido) {
          hidratarFormularioDesdeRegistroHistorial(elegido, servicioFallbackInicial);
        }
      }
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

  const intercambiarIndicesNigiri = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= NIGIRI_BASE || j >= NIGIRI_BASE || i === j) {
      return;
    }
    setError(null);
    setOmakaseNigiri((prev) => {
      const next = [...prev];
      const t = next[i];
      next[i] = next[j];
      next[j] = t;
      return next;
    });
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

  const hayBorradorEnFormulario = (): boolean => {
    if (menuNigiriOnly) {
      return omakaseNigiri.some((id) => id.trim().length > 0);
    }
    return (
      omakaseOtsumami.some((id) => id.trim().length > 0) ||
      omakaseNigiri.some((id) => id.trim().length > 0) ||
      omakasePostre.some((id) => id.trim().length > 0) ||
      omakaseOtsumamiRegalo.some((id) => id.trim().length > 0) ||
      extensionSlots.some((id) => id.trim().length > 0)
    );
  };

  const iniciarNuevoMenu = () => {
    if (hayBorradorEnFormulario()) {
      const ok = window.confirm(
        "¿Empezar un menú nuevo desde cero? Se vaciarán los platos y extras del generador que no hayas guardado en historial."
      );
      if (!ok) {
        return;
      }
    }
    const d = new Date();
    setOmakaseOtsumami(Array.from({ length: OTSUMAMI_BASE }, () => ""));
    setOmakaseOtsumamiRegalo(Array.from({ length: OTSUMAMI_REGALO }, () => ""));
    setOmakaseNigiri(Array.from({ length: NIGIRI_BASE }, () => ""));
    setOmakasePostre(Array.from({ length: POSTRE_BASE }, () => ""));
    setExtensionSlots(Array.from({ length: EXTENSION_SLOTS }, () => ""));
    setFechaServicio(formatFechaLocalYYYYMMDD(d));
    setHoraServicio(horaLocalHHmm(d));
    setServicio(d.getHours() < 17 ? "Mediodia" : "Noche");
    setMenuNigiriOnly(false);
    setResumenServicio(null);
    setEditorOcultoTrasGuardar(false);
    setError(null);
    setSuccess(
      "Menú nuevo en blanco: fecha y hora puestas a hoy. Cuando lo cierres, se guarda en historial."
    );
  };

  const cerrarYGuardarMenu = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    if (pasosBaseCompletados !== totalPasosBaseObjetivo) {
      setError(
        `Completa los ${totalPasosBaseObjetivo} pasos del Menú Omakase antes de guardar.`
      );
      setIsSaving(false);
      return;
    }

    const menuOmakaseFinal = (
      menuNigiriOnly
        ? [...omakaseNigiri]
        : [...omakaseOtsumami, ...omakaseNigiri, ...omakasePostre, ...omakaseOtsumamiRegalo]
    ).filter((id) => id.trim().length > 0);

    const extensionesFinal = extensionSlots.filter((id) => id.trim().length > 0);

    const payload: HistorialPayload = {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      menu_omakase: menuOmakaseFinal,
      extensiones: extensionesFinal,
    };

    const resumen = resumenDerivadoDelFormulario;

    try {
      const { error: saveError } = await supabase
        .from("historial_servicios")
        .insert(payload);

      if (saveError) {
        setResumenServicio(resumen);
        setEditorOcultoTrasGuardar(true);
        setSuccess(null);
        setError(
          `No se pudo guardar en la nube (el resumen de arriba es local hasta que se solucione). ${formatPostgrestError(saveError)}`
        );
        return;
      }

      setSuccess(
        `Menú guardado para ${fechaServicio} (${servicio} - ${horaServicio}).`
      );
      setResumenServicio(resumen);
      setEditorOcultoTrasGuardar(true);
    } catch (err) {
      setResumenServicio(resumen);
      setEditorOcultoTrasGuardar(true);
      setSuccess(null);
      setError(
        err instanceof Error
          ? `Error al guardar: ${err.message}`
          : "Error desconocido al conectar con Supabase."
      );
    } finally {
      setIsSaving(false);
    }
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
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full min-w-0 max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur sm:p-6">
        <header className="mb-4">
          <h1 className="font-display text-balance text-2xl font-medium tracking-tight text-ink sm:text-3xl md:text-4xl">
            Generador de Menú Diario
          </h1>
          <div className="mt-3 h-px w-12 bg-seal/70" />
          <p className="mt-3 text-pretty text-sm text-zinc-400">
            Si ya hay registros en historial, ves primero el{" "}
            <span className="text-zinc-300">último menú guardado</span> (solo lectura) con{" "}
            <span className="text-zinc-300">Editar menú</span> o{" "}
            <span className="text-zinc-300">Nuevo menú</span> para otro día.{" "}
            <span className="text-zinc-300">Ver sólo menú</span> vuelve al visor mientras editás.
            Sin historial, sólo el generador.
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
            Cargando historial, platos e ingredientes...
          </div>
        ) : (
          <>
            {resumenServicio && editorOcultoTrasGuardar ? (
              <div className="relative z-10 mb-6 min-w-0 rounded-xl border border-zinc-500/80 bg-zinc-950/95 p-3 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-sm ring-1 ring-zinc-500/20 sm:sticky sm:top-2 sm:p-5">
                <div className="mb-3 flex flex-col gap-2 border-b border-zinc-800/80 pb-3 max-sm:border-0 max-sm:pb-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Visor · último menú del historial · solo lectura
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-1 text-sm text-zinc-100">
                      <span className="tabular-nums">{resumenDerivadoDelFormulario.fecha}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="tabular-nums">{resumenDerivadoDelFormulario.hora}</span>
                      <span className="text-zinc-600">·</span>
                      <span>{resumenDerivadoDelFormulario.servicio}</span>
                      <span className="text-zinc-600">·</span>
                      <span>{resumenDerivadoDelFormulario.menuTipo}</span>
                    </p>
                    <p className="mt-1.5 max-w-xl text-[11px] leading-snug text-zinc-500">
                      Tomado del registro más reciente en la nube.{" "}
                      <span className="text-zinc-400">Editar menú</span> para retocar ese cierre;{" "}
                      <span className="text-zinc-400">Nuevo menú</span> para arrancar otro día en blanco.
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[11rem] sm:flex-row sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setEditorOcultoTrasGuardar(false)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900/40 sm:w-auto"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Editar menú
                    </button>
                    <button
                      type="button"
                      onClick={() => iniciarNuevoMenu()}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto"
                    >
                      <FilePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Nuevo menú
                    </button>
                  </div>
                </div>
                {/* Móvil: una sola sábana (scroll del documento). Desktop: panel sticky con scroll interno. */}
                <div className="min-w-0 max-sm:overflow-visible sm:max-h-[min(75vh,36rem)] sm:overflow-y-auto sm:overscroll-contain">
                  <MenuGuardadoSecciones
                    otsumami={resumenDerivadoDelFormulario.otsumamiBase}
                    nigiri={resumenDerivadoDelFormulario.nigiri}
                    postre={resumenDerivadoDelFormulario.postre}
                    regalo={resumenDerivadoDelFormulario.regalo}
                    extensiones={resumenDerivadoDelFormulario.extensiones}
                    nombrePlato={nombrePlato}
                  />
                </div>
              </div>
            ) : null}

            {editorOcultoTrasGuardar ? null : (
            <>
            {resumenServicio ? (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-400">
                  Editando menú del{" "}
                  <span className="tabular-nums text-zinc-200">{resumenDerivadoDelFormulario.fecha}</span>
                  {" · "}
                  <span className="text-zinc-200">{resumenDerivadoDelFormulario.servicio}</span>
                </p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => iniciarNuevoMenu()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/90"
                  >
                    <FilePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Nuevo menú
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorOcultoTrasGuardar(true)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/90"
                  >
                    <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Ver sólo menú
                  </button>
                </div>
              </div>
            ) : null}
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="min-w-0 text-balance break-words text-sm uppercase tracking-[0.16em] text-zinc-400">
                    Menú Omakase (Base {pasosBaseCompletados}/{totalPasosBaseObjetivo}
                    {!menuNigiriOnly
                      ? ` · Regalo ${pasosRegaloCompletados}/${OTSUMAMI_REGALO}`
                      : ""}
                    )
                  </h2>
                  <label className="inline-flex shrink-0 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-300">
                    <input
                      type="checkbox"
                      checked={menuNigiriOnly}
                      onChange={(event) => {
                        setMenuNigiriOnly(event.target.checked);
                        setError(null);
                      }}
                      className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-zinc-100"
                    />
                    Menú nigiri only
                  </label>
                </div>
                {menuOmakaseDisponibles.length > 0 ? (
                  <div className="space-y-4">
                    {!menuNigiriOnly ? (
                      <>
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
                      </>
                    ) : null}

                    <div>
                      <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Nigiri (12) · orden con flechas
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {omakaseNigiri.map((valor, index) => (
                          <div
                            key={`nigiri-${index + 1}`}
                            className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2 sm:px-3"
                          >
                            <div className="min-w-0 flex-1">
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
                            <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-zinc-800/80 pl-1.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => intercambiarIndicesNigiri(index, index - 1)}
                                title="Subir una posición (intercambia con el de arriba; si está vacío, queda como mover)"
                                aria-label={`Subir Nigiri ${index + 1}`}
                                className="inline-flex size-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ChevronUp className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                disabled={index >= NIGIRI_BASE - 1}
                                onClick={() => intercambiarIndicesNigiri(index, index + 1)}
                                title="Bajar una posición"
                                aria-label={`Bajar Nigiri ${index + 1}`}
                                className="inline-flex size-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!menuNigiriOnly ? (
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
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No hay platos omakase disponibles.
                  </p>
                )}
              </section>

              <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h2 className="mb-3 min-w-0 text-balance break-words text-sm uppercase tracking-[0.16em] text-zinc-400">
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
                                (plato) => {
                                  const yaEnMenu = idsEnMenuSeleccionado.has(plato.id);
                                  const yaEnExtras = esOpcionDuplicadaEnSeccion(
                                    extensionSlots,
                                    index,
                                    plato.id
                                  );
                                  // Nunca deshabilitar el valor ya elegido en este slot.
                                  const deshabilitado =
                                    (yaEnMenu || yaEnExtras) && plato.id !== valor;
                                  return (
                                    <option
                                      key={plato.id}
                                      value={plato.id}
                                      disabled={deshabilitado}
                                    >
                                      {plato.nombre}
                                      {yaEnMenu ? " · ya en el menú" : ""}
                                    </option>
                                  );
                                }
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

            <section className="mt-6 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h2 className="mb-3 min-w-0 text-sm uppercase tracking-[0.16em] text-zinc-400">
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
                  Seleccionados: {pasosBaseCompletados}/{totalPasosBaseObjetivo} base
                  {!menuNigiriOnly
                    ? ` + ${pasosRegaloCompletados}/${OTSUMAMI_REGALO} regalo`
                    : ""}
                  {" / "}
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
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
