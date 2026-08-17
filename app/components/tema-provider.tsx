"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  aplicarTemaEnDocumento,
  guardarTemaPreferencia,
  leerTemaPreferencia,
  resolverTema,
  siguienteTemaPreferencia,
  type TemaPreferencia,
  type TemaResuelto,
} from "@/src/lib/tema";

type TemaContextValue = {
  preferencia: TemaPreferencia;
  resuelto: TemaResuelto;
  setPreferencia: (preferencia: TemaPreferencia) => void;
  cicloPreferencia: () => void;
};

const TemaContext = createContext<TemaContextValue | null>(null);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const [preferencia, setPreferenciaState] = useState<TemaPreferencia>("auto");
  const [resuelto, setResuelto] = useState<TemaResuelto>("noche");

  const aplicar = useCallback((pref: TemaPreferencia) => {
    const siguiente = resolverTema(pref);
    setResuelto(siguiente);
    aplicarTemaEnDocumento(siguiente);
  }, []);

  useEffect(() => {
    const pref = leerTemaPreferencia();
    setPreferenciaState(pref);
    aplicar(pref);
  }, [aplicar]);

  useEffect(() => {
    if (preferencia !== "auto") {
      return;
    }
    const id = window.setInterval(() => aplicar("auto"), 60_000);
    const onVis = () => {
      if (!document.hidden) {
        aplicar("auto");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preferencia, aplicar]);

  const setPreferencia = useCallback(
    (pref: TemaPreferencia) => {
      setPreferenciaState(pref);
      guardarTemaPreferencia(pref);
      aplicar(pref);
    },
    [aplicar]
  );

  const cicloPreferencia = useCallback(() => {
    setPreferencia(siguienteTemaPreferencia(preferencia));
  }, [preferencia, setPreferencia]);

  const value = useMemo(
    () => ({ preferencia, resuelto, setPreferencia, cicloPreferencia }),
    [preferencia, resuelto, setPreferencia, cicloPreferencia]
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValue {
  const ctx = useContext(TemaContext);
  if (!ctx) {
    throw new Error("useTema debe usarse dentro de TemaProvider.");
  }
  return ctx;
}
