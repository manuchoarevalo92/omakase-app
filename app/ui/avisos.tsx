"use client";

import { CircleAlert, CircleCheck, Info, Undo2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Boton } from "./controles";
import { cx, vibrar } from "./haptica";
import { Hoja, useMontado } from "./hoja";

type Tono = "neutro" | "exito" | "error";

type AvisoEntrada = {
  id: number;
  texto: string;
  tono: Tono;
  deshacer?: () => void;
  ms: number;
};

type Confirmacion = {
  titulo: string;
  texto?: string;
  confirmar: string;
  peligro: boolean;
  resolver: (ok: boolean) => void;
};

type AvisosApi = {
  /** Mensaje corto abajo de la pantalla. Con `deshacer`, muestra el botón y dura 6 s. */
  aviso: (
    texto: string,
    opciones?: { tono?: Tono; deshacer?: () => void; ms?: number },
  ) => void;
  /** Reemplazo de window.confirm(): hoja con botón de acción y Cancelar. */
  confirmar: (opciones: {
    titulo: string;
    texto?: string;
    confirmar?: string;
    peligro?: boolean;
  }) => Promise<boolean>;
};

const AvisosContext = createContext<AvisosApi | null>(null);

const ICONO: Record<Tono, typeof Info> = {
  neutro: Info,
  exito: CircleCheck,
  error: CircleAlert,
};

export function AvisosProvider(props: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoEntrada[]>([]);
  const [conf, setConf] = useState<Confirmacion | null>(null);
  const siguiente = useRef(1);
  const montado = useMontado();

  const quitar = useCallback((id: number) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
  }, []);

  const aviso = useCallback<AvisosApi["aviso"]>((texto, opciones) => {
    const tono = opciones?.tono ?? "neutro";
    vibrar(tono === "error" ? "alerta" : tono === "exito" ? "exito" : "toque");
    const entrada: AvisoEntrada = {
      id: siguiente.current++,
      texto,
      tono,
      deshacer: opciones?.deshacer,
      ms: opciones?.ms ?? (opciones?.deshacer ? 6000 : 3200),
    };
    setAvisos((lista) => [...lista.slice(-2), entrada]);
  }, []);

  const confirmar = useCallback<AvisosApi["confirmar"]>(
    (o) =>
      new Promise<boolean>((resolver) => {
        setConf({
          titulo: o.titulo,
          texto: o.texto,
          confirmar: o.confirmar ?? "Confirmar",
          peligro: o.peligro ?? false,
          resolver,
        });
      }),
    [],
  );

  const cerrarConf = (ok: boolean) => {
    conf?.resolver(ok);
    setConf(null);
  };

  const api = useMemo(() => ({ aviso, confirmar }), [aviso, confirmar]);

  return (
    <AvisosContext.Provider value={api}>
      {props.children}
      {montado
        ? createPortal(
            <div
              aria-live="polite"
              className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6"
            >
              {avisos.map((a) => (
                <AvisoBurbuja key={a.id} aviso={a} onFin={() => quitar(a.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
      <Hoja abierta={conf !== null} onCerrar={() => cerrarConf(false)}>
        {conf ? (
          <div className="pt-2 text-center">
            <h2 className="text-[1.06rem] font-semibold">{conf.titulo}</h2>
            {conf.texto ? (
              <p className="mx-auto mt-1.5 max-w-sm text-[0.94rem] text-label-2">
                {conf.texto}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <Boton
                variante={conf.peligro ? "peligro" : "primario"}
                ancho
                onClick={() => cerrarConf(true)}
              >
                {conf.confirmar}
              </Boton>
              <Boton
                variante="secundario"
                ancho
                onClick={() => cerrarConf(false)}
              >
                Cancelar
              </Boton>
            </div>
          </div>
        ) : null}
      </Hoja>
    </AvisosContext.Provider>
  );
}

function AvisoBurbuja(props: { aviso: AvisoEntrada; onFin: () => void }) {
  const { aviso, onFin } = props;
  const Icono = ICONO[aviso.tono];
  useEffect(() => {
    const t = window.setTimeout(onFin, aviso.ms);
    return () => window.clearTimeout(t);
  }, [aviso.ms, onFin]);

  return (
    <div
      role="status"
      className="ui-aviso-entra pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl bg-[var(--aviso)] py-2 pl-4 pr-2 text-[0.94rem] text-[#f3f0ea] shadow-[0_10px_30px_rgb(0_0_0/0.3)]"
    >
      <Icono
        className={cx(
          "h-[18px] w-[18px] shrink-0",
          aviso.tono === "exito"
            ? "text-[#6fc796]"
            : aviso.tono === "error"
              ? "text-[#f08a7e]"
              : "text-[#b0aaa0]",
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 py-1">{aviso.texto}</p>
      {aviso.deshacer ? (
        <button
          type="button"
          onClick={() => {
            aviso.deshacer?.();
            onFin();
          }}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 font-semibold text-[#f0a79e] transition active:scale-95"
        >
          <Undo2 className="h-4 w-4" aria-hidden />
          Deshacer
        </button>
      ) : null}
    </div>
  );
}

export function useAvisos(): AvisosApi {
  const ctx = useContext(AvisosContext);
  if (!ctx) {
    throw new Error("useAvisos debe usarse dentro de AvisosProvider.");
  }
  return ctx;
}
