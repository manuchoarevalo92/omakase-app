"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

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

/*
  La preferencia vive en localStorage y el tema resuelto depende de la hora.
  Se leen como "stores" externos: en el servidor valen "auto" / "noche" y en el
  cliente se actualizan al cambiar la preferencia (en esta pestaña o en otra),
  cada minuto y al volver a la app.
*/
const oyentes = new Set<() => void>();

function avisarCambio() {
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  const intervalo = window.setInterval(oyente, 60_000);
  const alVolver = () => {
    if (!document.hidden) oyente();
  };
  window.addEventListener("storage", oyente);
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    oyentes.delete(oyente);
    window.clearInterval(intervalo);
    window.removeEventListener("storage", oyente);
    document.removeEventListener("visibilitychange", alVolver);
  };
}

const preferenciaServidor = (): TemaPreferencia => "auto";
const resueltoServidor = (): TemaResuelto => "noche";
const resueltoCliente = (): TemaResuelto => resolverTema(leerTemaPreferencia());

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const preferencia = useSyncExternalStore(
    suscribir,
    leerTemaPreferencia,
    preferenciaServidor,
  );
  const resuelto = useSyncExternalStore(
    suscribir,
    resueltoCliente,
    resueltoServidor,
  );

  // Se aplica el valor real del cliente (en la hidratación `resuelto` todavía
  // vale el del servidor y no queremos un parpadeo a noche).
  useEffect(() => {
    aplicarTemaEnDocumento(resueltoCliente());
  }, [resuelto, preferencia]);

  const setPreferencia = useCallback((pref: TemaPreferencia) => {
    guardarTemaPreferencia(pref);
    avisarCambio();
  }, []);

  const cicloPreferencia = useCallback(() => {
    setPreferencia(siguienteTemaPreferencia(leerTemaPreferencia()));
  }, [setPreferencia]);

  const value = useMemo(
    () => ({ preferencia, resuelto, setPreferencia, cicloPreferencia }),
    [preferencia, resuelto, setPreferencia, cicloPreferencia],
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
