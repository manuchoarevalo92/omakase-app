"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  FilePlus,
  List,
  Lock,
  Pencil,
} from "lucide-react";

import { MenuGuardadoSecciones } from "@/app/components/menu-guardado-secciones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  MENU_GUARDADO_NIGIRI,
  MENU_GUARDADO_OTSUMAMI,
  MENU_GUARDADO_POSTRE,
  partesDesdeMenuOmakaseGuardado,
} from "@/src/lib/menu-omakase-guardado";
import {
  formatearFechaServicio,
  formatearHoraServicio,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";
import {
  Boton,
  Campo,
  Etiqueta,
  EsqueletoLista,
  Fecha,
  HojaOpciones,
  Pantalla,
  Seccion,
  Segmentado,
  cx,
  useAvisos,
  type OpcionSelector,
} from "@/app/ui";

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
    d.getDate(),
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
function compararHistorialMasReciente(
  a: RegistroHistorialRow,
  b: RegistroHistorialRow,
): number {
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
  rows: RegistroHistorialRow[],
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
  const [omakaseOtsumami, setOmakaseOtsumami] = useState<string[]>(() =>
    Array.from({ length: OTSUMAMI_BASE }, () => ""),
  );
  const [omakaseOtsumamiRegalo, setOmakaseOtsumamiRegalo] = useState<string[]>(
    () => Array.from({ length: OTSUMAMI_REGALO }, () => ""),
  );
  const [omakaseNigiri, setOmakaseNigiri] = useState<string[]>(() =>
    Array.from({ length: NIGIRI_BASE }, () => ""),
  );
  const [omakasePostre, setOmakasePostre] = useState<string[]>(() =>
    Array.from({ length: POSTRE_BASE }, () => ""),
  );
  const [extensionSlots, setExtensionSlots] = useState<string[]>(() =>
    Array.from({ length: EXTENSION_SLOTS }, () => ""),
  );
  const [fechaServicio, setFechaServicio] = useState(() =>
    formatFechaLocalYYYYMMDD(now),
  );
  const [horaServicio, setHoraServicio] = useState(
    `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`,
  );
  const [servicio, setServicio] = useState<Servicio>(
    now.getHours() < 17 ? "Mediodia" : "Noche",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aviso, confirmar } = useAvisos();
  const [resumenServicio, setResumenServicio] =
    useState<ResumenServicio | null>(null);
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
      disponible: (plato.ingredientes_requeridos ?? []).every(
        (ingredienteId) => {
          const ingrediente = ingredientesMap.get(ingredienteId);
          return ingrediente ? ingrediente.disponible : false;
        },
      ),
    }));
  }, [platos, ingredientesMap]);

  const menuOmakaseDisponibles = useMemo(() => {
    return platosConEstado.filter(
      (plato) =>
        CATEGORIAS_OMAKASE.includes(plato.categoria) && plato.disponible,
    );
  }, [platosConEstado]);

  const omakaseOpcionesPorCategoria = useMemo(() => {
    const map = new Map<Categoria, (Plato & { disponible: boolean })[]>(
      CATEGORIAS_OMAKASE.map((categoria) => [categoria, []]),
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
    return [...omakaseOtsumami, ...omakaseNigiri, ...omakasePostre].filter(
      (id) => id.trim().length > 0,
    ).length;
  }, [menuNigiriOnly, omakaseNigiri, omakaseOtsumami, omakasePostre]);

  const totalPasosBaseObjetivo = menuNigiriOnly
    ? NIGIRI_BASE
    : TOTAL_ITEMS_OMAKASE_CLASICO;

  const pasosRegaloCompletados = useMemo(
    () => omakaseOtsumamiRegalo.filter((id) => id.trim().length > 0).length,
    [omakaseOtsumamiRegalo],
  );

  const extrasDisponiblesPorCategoria = useMemo(() => {
    const map = new Map<Categoria, (Plato & { disponible: boolean })[]>(
      CATEGORIAS_EXTRAS.map((categoria) => [categoria, []]),
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
      0,
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
      otsumamiBase: menuNigiriOnly
        ? []
        : omakaseOtsumami.filter((id) => id.trim().length > 0),
      nigiri: omakaseNigiri.filter((id) => id.trim().length > 0),
      postre: menuNigiriOnly
        ? []
        : omakasePostre.filter((id) => id.trim().length > 0),
      regalo: menuNigiriOnly
        ? []
        : omakaseOtsumamiRegalo.filter((id) => id.trim().length > 0),
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
    servicioFallback: Servicio,
  ): void => {
    const idsSinVacios = (elegido.menu_omakase ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    const minPlatosClasico =
      MENU_GUARDADO_OTSUMAMI + MENU_GUARDADO_NIGIRI + MENU_GUARDADO_POSTRE;
    const maxPlatosClasico = minPlatosClasico + OTSUMAMI_REGALO;

    const esNigiriOnly = idsSinVacios.length === MENU_GUARDADO_NIGIRI;
    const esClasicoValido =
      idsSinVacios.length >= minPlatosClasico &&
      idsSinVacios.length <= maxPlatosClasico;

    if (!esNigiriOnly && !esClasicoValido) {
      return;
    }

    const refDate = new Date();
    // "20:01:00+00" → "20:01" para el campo de hora.
    const horaEtiqueta = elegido.hora?.trim()
      ? formatearHoraServicio(elegido.hora)
      : horaLocalHHmm(refDate);
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

    const ext = (elegido.extensiones ?? [])
      .map(String)
      .filter((id) => id.trim());
    setExtensionSlots(rellenarIdsPorSlot(ext, EXTENSION_SLOTS));
    // La base devuelve fecha con zona ("2026-11-25T00:00:00+00:00"); los campos usan YYYY-MM-DD.
    setFechaServicio(elegido.fecha.slice(0, 10));
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
          historialResponse.data as RegistroHistorialRow[],
        );
        if (elegido) {
          hidratarFormularioDesdeRegistroHistorial(
            elegido,
            servicioFallbackInicial,
          );
        }
      }
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

  const actualizarPasoOmakase = (
    index: number,
    platoId: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) => {
    setError(null);
    setter((actual) => actual.map((item, i) => (i === index ? platoId : item)));
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
      actual.map((item, i) => (i === index ? platoId : item)),
    );
  };

  const esOpcionDuplicadaEnSeccion = (
    seccion: string[],
    indexActual: number,
    platoId: string,
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

  const iniciarNuevoMenu = async () => {
    if (hayBorradorEnFormulario()) {
      const ok = await confirmar({
        titulo: "¿Empezar un menú nuevo?",
        texto:
          "Se vacían los platos y extras que no hayas guardado en historial.",
        confirmar: "Empezar de cero",
        peligro: true,
      });
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
    aviso("Menú nuevo en blanco, con fecha y hora de ahora.");
  };

  const cerrarYGuardarMenu = async () => {
    setIsSaving(true);
    setError(null);

    if (pasosBaseCompletados !== totalPasosBaseObjetivo) {
      aviso(
        `Faltan ${totalPasosBaseObjetivo - pasosBaseCompletados} platos: completá los ${totalPasosBaseObjetivo} pasos antes de guardar.`,
        { tono: "error" },
      );
      setIsSaving(false);
      return;
    }

    const menuOmakaseFinal = (
      menuNigiriOnly
        ? [...omakaseNigiri]
        : [
            ...omakaseOtsumami,
            ...omakaseNigiri,
            ...omakasePostre,
            ...omakaseOtsumamiRegalo,
          ]
    ).filter((id) => id.trim().length > 0);

    const extensionesFinal = extensionSlots.filter(
      (id) => id.trim().length > 0,
    );

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
        aviso("No se pudo guardar en la nube.", { tono: "error" });
        setError(
          `No se pudo guardar en la nube (el resumen de arriba es local hasta que se solucione). ${formatPostgrestError(saveError)}`,
        );
        return;
      }

      aviso(
        `Menú guardado: ${formatearFechaServicio(fechaServicio)} · ${servicio === "Mediodia" ? "Mediodía" : servicio} · ${formatearHoraServicio(horaServicio)}`,
        { tono: "exito" },
      );
      setResumenServicio(resumen);
      setEditorOcultoTrasGuardar(true);
    } catch (err) {
      setResumenServicio(resumen);
      setEditorOcultoTrasGuardar(true);
      aviso("No se pudo guardar en la nube.", { tono: "error" });
      setError(
        err instanceof Error
          ? `Error al guardar: ${err.message}`
          : "Error desconocido al conectar con Supabase.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const nombrePlato = (id: string) =>
    platosPorId.get(id)?.nombre ?? "Plato no encontrado";

  const textoIngredientes = (plato: Plato) =>
    (plato.ingredientes_requeridos ?? [])
      .map((id) => ingredientesMap.get(id)?.nombre)
      .filter(Boolean)
      .join(" · ");

  /** Qué ingredientes le faltan a un plato no disponible (los que no están o están agotados). */
  const ingredientesFaltantes = (plato: Plato) =>
    (plato.ingredientes_requeridos ?? [])
      .map((id) => ingredientesMap.get(id))
      .filter((ing) => !ing?.disponible)
      .map((ing) => ing?.nombre ?? "ingrediente borrado")
      .join(", ");

  const opcionesDe = (
    categoria: Categoria,
    seccion: string[],
    index: number,
  ): OpcionSelector<string>[] =>
    (omakaseOpcionesPorCategoria.get(categoria) ?? []).map((plato) => ({
      valor: plato.id,
      label: plato.nombre,
      detalle: textoIngredientes(plato) || undefined,
      deshabilitada: esOpcionDuplicadaEnSeccion(seccion, index, plato.id),
    }));

  const opcionesExtra = (index: number): OpcionSelector<string>[] =>
    CATEGORIAS_EXTRAS.flatMap((categoria) =>
      (extrasDisponiblesPorCategoria.get(categoria) ?? []).map((plato) => {
        const yaEnMenu = idsEnMenuSeleccionado.has(plato.id);
        const yaEnExtras = esOpcionDuplicadaEnSeccion(
          extensionSlots,
          index,
          plato.id,
        );
        const valor = extensionSlots[index];
        return {
          valor: plato.id,
          label: plato.nombre,
          grupo: categoria,
          detalle: yaEnMenu
            ? "Ya está en el menú"
            : textoIngredientes(plato) || undefined,
          // Nunca deshabilitar el valor ya elegido en este slot.
          deshabilitada: (yaEnMenu || yaEnExtras) && plato.id !== valor,
        };
      }),
    );

  const extrasElegidos = extensionSlots.filter((id) => id).length;
  const completo = pasosBaseCompletados === totalPasosBaseObjetivo;
  const resumen = resumenDerivadoDelFormulario;
  const etiquetaServicio = (s: Servicio) => (s === "Mediodia" ? "Mediodía" : s);
  const enVisor = Boolean(resumenServicio && editorOcultoTrasGuardar);

  return (
    <Pantalla
      titulo="Omakase"
      subtitulo={
        isLoading
          ? "Cargando…"
          : enVisor
            ? "Último menú guardado"
            : "Armando el menú del día"
      }
      ancho="amplio"
      ayuda={
        <>
          <p>
            Al abrir ves el{" "}
            <strong className="text-label">último menú guardado</strong> en el
            historial, solo para leer.
          </p>
          <p>
            <strong className="text-label">Editar</strong> retoca ese cierre;{" "}
            <strong className="text-label">Nuevo</strong> arranca otro día en
            blanco con la fecha y hora de ahora.
          </p>
          <p>
            Cada paso se elige de la lista de platos <em>disponibles</em> (con
            todos sus ingredientes en stock). Los Nigiri se ordenan con las
            flechas. Al terminar,{" "}
            <strong className="text-label">Cerrar y guardar</strong> lo manda al
            historial.
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
        <div className="space-y-6">
          <EsqueletoLista filas={4} />
          <EsqueletoLista filas={6} />
        </div>
      ) : enVisor ? (
        <>
          <div className="rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[1.6rem] font-semibold leading-tight text-label">
                  {formatearFechaServicio(resumen.fecha)}
                </p>
                <p className="mt-0.5 text-[0.94rem] text-label-2">
                  {etiquetaServicio(resumen.servicio)} ·{" "}
                  {formatearHoraServicio(resumen.hora)}
                </p>
              </div>
              <Etiqueta
                tono={resumen.menuTipo === "Clasico" ? "acento" : "info"}
              >
                {resumen.menuTipo === "Clasico" ? "Clásico" : "Nigiri only"}
              </Etiqueta>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Boton
                variante="secundario"
                icono={<Pencil className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => setEditorOcultoTrasGuardar(false)}
              >
                Editar
              </Boton>
              <Boton
                variante="secundario"
                icono={<FilePlus className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void iniciarNuevoMenu()}
              >
                Nuevo
              </Boton>
            </div>
          </div>
          <div className="mt-6">
            <MenuGuardadoSecciones
              otsumami={resumen.otsumamiBase}
              nigiri={resumen.nigiri}
              postre={resumen.postre}
              regalo={resumen.regalo}
              extensiones={resumen.extensiones}
              nombrePlato={nombrePlato}
            />
          </div>
        </>
      ) : (
        <>
          {resumenServicio ? (
            <div className="mb-4 flex items-center gap-2 rounded-card bg-fill py-1.5 pl-4 pr-1.5">
              <p className="min-w-0 flex-1 leading-tight">
                <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                  Editando
                </span>
                <span className="block truncate text-[0.9rem] text-label">
                  {formatearFechaServicio(resumen.fecha)} ·{" "}
                  {etiquetaServicio(resumen.servicio)}
                </span>
              </p>
              <Boton
                variante="terciario"
                tamano="chico"
                icono={<List className="h-4 w-4" aria-hidden />}
                onClick={() => setEditorOcultoTrasGuardar(true)}
              >
                Ver menú
              </Boton>
              <Boton
                variante="terciario"
                tamano="chico"
                icono={<FilePlus className="h-4 w-4" aria-hidden />}
                onClick={() => void iniciarNuevoMenu()}
              >
                Nuevo
              </Boton>
            </div>
          ) : null}

          <Segmentado
            etiqueta="Tipo de menú"
            valor={menuNigiriOnly ? "nigiri" : "clasico"}
            onChange={(v) => {
              setMenuNigiriOnly(v === "nigiri");
              setError(null);
            }}
            opciones={[
              { valor: "clasico", label: "Clásico" },
              { valor: "nigiri", label: "Nigiri only" },
            ]}
          />

          <div className="mt-4 rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[0.94rem] text-label-2">
                <span className="font-semibold tabular-nums text-label">
                  {pasosBaseCompletados}/{totalPasosBaseObjetivo}
                </span>{" "}
                platos del menú
              </p>
              <p className="text-[0.84rem] tabular-nums text-label-3">
                {!menuNigiriOnly
                  ? `Regalo ${pasosRegaloCompletados}/${OTSUMAMI_REGALO} · `
                  : ""}
                Extras {extrasElegidos}/{EXTENSION_SLOTS}
              </p>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill"
              role="progressbar"
              aria-label="Platos del menú elegidos"
              aria-valuenow={pasosBaseCompletados}
              aria-valuemin={0}
              aria-valuemax={totalPasosBaseObjetivo}
            >
              <div
                className={cx(
                  "h-full rounded-full transition-all duration-300",
                  completo ? "bg-success" : "bg-accent",
                )}
                style={{
                  width: `${(pasosBaseCompletados / totalPasosBaseObjetivo) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="grid min-w-0 gap-x-6 md:grid-cols-2">
            <div className="min-w-0">
              {menuOmakaseDisponibles.length === 0 ? (
                <Seccion titulo="Menú">
                  <p className="rounded-card bg-surface-3 px-4 py-4 text-label-2">
                    No hay platos omakase disponibles: revisá los ingredientes
                    agotados.
                  </p>
                </Seccion>
              ) : (
                <>
                  {!menuNigiriOnly ? (
                    <>
                      <Seccion titulo="Otsumami">
                        <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                          {omakaseOtsumami.map((valor, index) => (
                            <SlotPlato
                              key={`otsu-${index}`}
                              numero={index + 1}
                              titulo={`Otsumami ${index + 1}`}
                              placeholder="Elegir otsumami"
                              valor={valor}
                              nombre={valor ? nombrePlato(valor) : null}
                              opciones={opcionesDe(
                                "Otsumami",
                                omakaseOtsumami,
                                index,
                              )}
                              onElegir={(id) =>
                                actualizarPasoOmakase(
                                  index,
                                  id,
                                  setOmakaseOtsumami,
                                )
                              }
                            />
                          ))}
                        </ul>
                      </Seccion>
                      <Seccion
                        titulo="Regalo"
                        pie="Opcionales: no cuentan para completar el menú."
                      >
                        <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                          {omakaseOtsumamiRegalo.map((valor, index) => (
                            <SlotPlato
                              key={`regalo-${index}`}
                              numero={index + 1}
                              titulo={`Regalo ${index + 1}`}
                              placeholder="Sin regalo"
                              valor={valor}
                              nombre={valor ? nombrePlato(valor) : null}
                              opciones={opcionesDe(
                                "Otsumami",
                                omakaseOtsumamiRegalo,
                                index,
                              )}
                              vaciar="Sin regalo"
                              onElegir={(id) =>
                                actualizarPasoOmakase(
                                  index,
                                  id,
                                  setOmakaseOtsumamiRegalo,
                                )
                              }
                            />
                          ))}
                        </ul>
                      </Seccion>
                    </>
                  ) : null}

                  <Seccion
                    titulo="Nigiri"
                    pie="Las flechas cambian el orden de servicio."
                  >
                    <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                      {omakaseNigiri.map((valor, index) => (
                        <SlotPlato
                          key={`nigiri-${index}`}
                          numero={index + 1}
                          titulo={`Nigiri ${index + 1}`}
                          placeholder="Elegir nigiri"
                          valor={valor}
                          nombre={valor ? nombrePlato(valor) : null}
                          opciones={opcionesDe("Nigiri", omakaseNigiri, index)}
                          onElegir={(id) =>
                            actualizarPasoOmakase(index, id, setOmakaseNigiri)
                          }
                          orden={{
                            subir:
                              index > 0
                                ? () =>
                                    intercambiarIndicesNigiri(index, index - 1)
                                : undefined,
                            bajar:
                              index < NIGIRI_BASE - 1
                                ? () =>
                                    intercambiarIndicesNigiri(index, index + 1)
                                : undefined,
                          }}
                        />
                      ))}
                    </ul>
                  </Seccion>

                  {!menuNigiriOnly ? (
                    <Seccion titulo="Postre">
                      <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                        {omakasePostre.map((valor, index) => (
                          <SlotPlato
                            key={`postre-${index}`}
                            titulo="Postre"
                            placeholder="Elegir postre"
                            valor={valor}
                            nombre={valor ? nombrePlato(valor) : null}
                            opciones={opcionesDe(
                              "Postre",
                              omakasePostre,
                              index,
                            )}
                            onElegir={(id) =>
                              actualizarPasoOmakase(index, id, setOmakasePostre)
                            }
                          />
                        ))}
                      </ul>
                    </Seccion>
                  ) : null}
                </>
              )}
            </div>

            <div className="min-w-0">
              <Seccion
                titulo="Extras"
                pie="Hasta cinco: otsumami, nigiri o extensiones disponibles que no estén ya en el menú."
              >
                {extrasDisponiblesTotal > 0 ? (
                  <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                    {extensionSlots.map((valor, index) => (
                      <SlotPlato
                        key={`extra-${index}`}
                        numero={index + 1}
                        titulo={`Extra ${index + 1}`}
                        placeholder="Sin extra"
                        valor={valor}
                        nombre={valor ? nombrePlato(valor) : null}
                        opciones={opcionesExtra(index)}
                        vaciar="Sin extra"
                        buscar
                        onElegir={(id) => actualizarExtensionSlot(index, id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-card bg-surface-3 px-4 py-4 text-label-2">
                    No hay platos disponibles para extras.
                  </p>
                )}
              </Seccion>

              <Seccion titulo="Servicio">
                <div className="space-y-3">
                  <Fecha valor={fechaServicio} onChange={setFechaServicio} />
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                    <Campo
                      type="time"
                      aria-label="Hora del servicio"
                      value={horaServicio}
                      onChange={(event) => setHoraServicio(event.target.value)}
                      className="text-center tabular-nums"
                    />
                    <Segmentado
                      etiqueta="Servicio"
                      valor={servicio}
                      onChange={setServicio}
                      opciones={[
                        { valor: "Mediodia", label: "Mediodía" },
                        { valor: "Noche", label: "Noche" },
                      ]}
                    />
                  </div>
                </div>
              </Seccion>

              <Seccion
                titulo={`No disponibles · ${platosNoDisponibles.length}`}
              >
                {platosNoDisponibles.length > 0 ? (
                  <details className="group overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-[0.94rem] text-label-2 [&::-webkit-details-marker]:hidden">
                      <Lock
                        className="h-4 w-4 shrink-0 text-label-3"
                        aria-hidden
                      />
                      <span className="flex-1">
                        Ver qué falta para cada plato
                      </span>
                      <ChevronRight
                        className="h-[18px] w-[18px] text-label-3 transition group-open:rotate-90"
                        aria-hidden
                      />
                    </summary>
                    <ul className="border-t border-separator">
                      {platosNoDisponibles.map((plato) => (
                        <li
                          key={plato.id}
                          className="border-b border-separator px-4 py-2.5 last:border-0"
                        >
                          <p className="text-[0.97rem] text-label">
                            {plato.nombre}
                          </p>
                          <p className="text-[0.84rem] text-label-3">
                            {plato.categoria} · falta{" "}
                            {ingredientesFaltantes(plato) ||
                              "asignar ingredientes"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="rounded-card bg-surface-3 px-4 py-3 text-label-2">
                    Todos los platos están disponibles.
                  </p>
                )}
              </Seccion>
            </div>
          </div>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 -mx-4 mt-6 px-4 pb-1 sm:bottom-4 sm:mx-0 sm:px-0">
            <Boton
              ancho
              tamano="grande"
              variante={completo ? "primario" : "secundario"}
              cargando={isSaving}
              onClick={() => void cerrarYGuardarMenu()}
              className={cx(
                "shadow-[0_8px_24px_rgb(0_0_0/0.18)]",
                completo ? "" : "bg-surface-3 backdrop-blur-xl",
              )}
            >
              {isSaving
                ? "Guardando…"
                : completo
                  ? "Cerrar menú y guardar"
                  : `Faltan ${totalPasosBaseObjetivo - pasosBaseCompletados} para cerrar`}
            </Boton>
          </div>
        </>
      )}
    </Pantalla>
  );
}

/**
 * Un paso del menú: muestra el plato elegido (o el lugar vacío) y al tocarlo abre
 * la hoja con los platos disponibles. Los Nigiri suman flechas para reordenar.
 */
function SlotPlato(props: {
  numero?: number;
  titulo: string;
  placeholder: string;
  valor: string;
  nombre: string | null;
  opciones: OpcionSelector<string>[];
  onElegir: (id: string) => void;
  vaciar?: string;
  buscar?: boolean;
  orden?: { subir?: () => void; bajar?: () => void };
}) {
  const {
    numero,
    titulo,
    placeholder,
    valor,
    nombre,
    opciones,
    onElegir,
    vaciar,
    buscar,
    orden,
  } = props;
  const [abierta, setAbierta] = useState(false);
  return (
    <li className="flex min-h-14 items-center border-b border-separator last:border-0">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`${titulo}: ${nombre ?? placeholder}`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left transition active:bg-fill"
      >
        {numero !== undefined ? (
          <span
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[0.8rem] tabular-nums",
              nombre ? "bg-accent-soft text-accent" : "bg-fill text-label-3",
            )}
          >
            {numero}
          </span>
        ) : null}
        <span
          className={cx(
            "min-w-0 flex-1 text-[1rem] leading-snug",
            nombre ? "text-label" : "text-label-3",
          )}
        >
          {nombre ?? placeholder}
        </span>
        {orden ? null : (
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 text-label-3"
            aria-hidden
          />
        )}
      </button>
      {orden ? (
        <div className="flex shrink-0 items-center pr-1.5">
          <button
            type="button"
            disabled={!orden.subir}
            onClick={orden.subir}
            aria-label={`Subir ${titulo}`}
            className="inline-flex size-10 items-center justify-center rounded-full text-label-2 transition active:scale-90 active:bg-fill disabled:opacity-25"
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!orden.bajar}
            onClick={orden.bajar}
            aria-label={`Bajar ${titulo}`}
            className="inline-flex size-10 items-center justify-center rounded-full text-label-2 transition active:scale-90 active:bg-fill disabled:opacity-25"
          >
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
      <HojaOpciones
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={titulo}
        opciones={opciones}
        valor={valor || (vaciar ? "" : null)}
        onElegir={onElegir}
        buscar={buscar ?? opciones.length > 12}
        vaciar={vaciar ? { valor: "", label: vaciar } : undefined}
      />
    </li>
  );
}
