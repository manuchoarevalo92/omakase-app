"use client";

import { Camera, ChevronLeft, ChevronRight, Leaf, Loader2, Pencil, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  CATEGORIAS_GUIA,
  actualizarBebida,
  crearBebida,
  labelCategoria,
  subirFotoBebida,
  type CategoriaGuia,
  type GuiaBebida,
  type GuiaBebidaEdicion,
} from "@/src/lib/guia-bebidas";

import { FotoBotella, Md } from "./ui";

const INPUT =
  "w-full rounded-lg border border-separator bg-surface px-3 py-2.5 text-base text-label outline-none focus:border-accent";
const LABEL = "mb-1 block text-xs font-medium text-label-3";

export function Etiquetas(props: { bebida: GuiaBebida }) {
  const { bebida } = props;
  if (!bebida.minimaIntervencion && !bebida.aConfirmar && bebida.activa) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {bebida.minimaIntervencion ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-ok/50 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-ok">
          <Leaf className="h-3 w-3" aria-hidden />
          Mínima intervención
        </span>
      ) : null}
      {bebida.aConfirmar ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber/50 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber">
          <TriangleAlert className="h-3 w-3" aria-hidden />
          Datos a confirmar
        </span>
      ) : null}
      {!bebida.activa ? (
        <span className="inline-flex items-center rounded-full border border-fill-strong px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-label-2">
          Fuera de carta
        </span>
      ) : null}
    </div>
  );
}

function edicionDesde(bebida: GuiaBebida | null, categoria: CategoriaGuia): GuiaBebidaEdicion {
  return {
    nombre: bebida?.nombre ?? "",
    categoria: bebida?.categoria ?? categoria,
    subgrupo: bebida?.subgrupo ?? "",
    precio: bebida?.precio ?? "",
    meta: bebida?.meta ?? "",
    datos: bebida?.datos ?? [],
    enSala: bebida?.enSala ?? "",
    minimaIntervencion: bebida?.minimaIntervencion ?? false,
    aConfirmar: bebida?.aConfirmar ?? false,
    activa: bebida?.activa ?? true,
  };
}

function FormularioFicha(props: {
  bebida: GuiaBebida | null;
  categoriaInicial: CategoriaGuia;
  ordenNuevo: number;
  onGuardada: (bebida: GuiaBebida) => void;
  onCancelar: () => void;
}) {
  const { bebida, categoriaInicial, ordenNuevo, onGuardada, onCancelar } = props;
  const [form, setForm] = useState<GuiaBebidaEdicion>(() => edicionDesde(bebida, categoriaInicial));
  const [datosTexto, setDatosTexto] = useState(() => (bebida?.datos ?? []).join("\n\n"));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setGuardando(true);
    setError(null);
    const edicion = { ...form, datos: datosTexto.split(/\n+/) };
    try {
      const guardada = bebida
        ? await actualizarBebida(bebida.id, edicion)
        : await crearBebida(edicion, ordenNuevo);
      onGuardada(guardada);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL} htmlFor="guia-nombre">
          Nombre
        </label>
        <input
          id="guia-nombre"
          className={INPUT}
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="guia-categoria">
            Categoría
          </label>
          <select
            id="guia-categoria"
            className={INPUT}
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaGuia })}
          >
            {CATEGORIAS_GUIA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="guia-precio">
            Precio
          </label>
          <input
            id="guia-precio"
            className={INPUT}
            placeholder="85 €"
            value={form.precio ?? ""}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="guia-subgrupo">
          Grupo dentro de la categoría
        </label>
        <input
          id="guia-subgrupo"
          className={INPUT}
          placeholder="Dry · secos y nítidos"
          value={form.subgrupo ?? ""}
          onChange={(e) => setForm({ ...form, subgrupo: e.target.value })}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="guia-meta">
          Productor · zona · tipo
        </label>
        <input
          id="guia-meta"
          className={INPUT}
          value={form.meta ?? ""}
          onChange={(e) => setForm({ ...form, meta: e.target.value })}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="guia-sala">
          En sala
        </label>
        <textarea
          id="guia-sala"
          rows={3}
          className={INPUT}
          value={form.enSala ?? ""}
          onChange={(e) => setForm({ ...form, enSala: e.target.value })}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="guia-datos">
          Datos (un párrafo por línea; **negrita** y *cursiva*)
        </label>
        <textarea
          id="guia-datos"
          rows={9}
          className={INPUT}
          value={datosTexto}
          onChange={(e) => setDatosTexto(e.target.value)}
        />
      </div>
      <div className="space-y-2 text-sm text-label-2">
        {(
          [
            ["minimaIntervencion", "Mínima intervención"],
            ["aConfirmar", "Tiene datos a confirmar"],
            ["activa", "Está en carta"],
          ] as const
        ).map(([campo, texto]) => (
          <label key={campo} className="flex min-h-9 items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--seal)]"
              checked={form[campo]}
              onChange={(e) => setForm({ ...form, [campo]: e.target.checked })}
            />
            {texto}
          </label>
        ))}
      </div>
      {error ? (
        <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-11 flex-1 rounded-lg border border-separator px-4 text-sm text-label-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-seal px-4 text-sm font-medium text-[#fff] disabled:opacity-60"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Guardar
        </button>
      </div>
    </div>
  );
}

/**
 * Ficha completa en hoja a pantalla completa (celular) o modal (escritorio).
 * `bebida === null` abre el formulario de alta.
 */
export function FichaBebida(props: {
  bebida: GuiaBebida | null;
  esAdmin: boolean;
  categoriaInicial: CategoriaGuia;
  ordenNuevo: number;
  onCerrar: () => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  onGuardada: (bebida: GuiaBebida) => void;
}) {
  const { bebida, esAdmin, categoriaInicial, ordenNuevo, onCerrar, onAnterior, onSiguiente, onGuardada } = props;
  const [editando, setEditando] = useState(bebida === null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (editando) return;
      if (e.key === "ArrowLeft") onAnterior?.();
      if (e.key === "ArrowRight") onSiguiente?.();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar, onAnterior, onSiguiente, editando]);

  const subirFoto = async (file: File | undefined) => {
    if (!file || !bebida) return;
    setSubiendo(true);
    setErrorFoto(null);
    try {
      const url = await subirFotoBebida(bebida, file);
      onGuardada({ ...bebida, fotoUrl: url });
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-6">
      <button type="button" aria-label="Cerrar ficha" className="absolute inset-0 cursor-default" onClick={onCerrar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={bebida?.nombre ?? "Nueva bebida"}
        className="relative flex h-[100dvh] w-full flex-col bg-surface sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-separator"
      >
        <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:pt-2">
          <p className="truncate pl-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-label-3">
            {bebida ? labelCategoria(bebida.categoria) : "Nueva bebida"}
            {bebida?.subgrupo ? ` · ${bebida.subgrupo.split(" · ")[0]}` : ""}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {esAdmin && bebida && !editando ? (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="inline-flex size-11 items-center justify-center rounded-lg text-label-2 hover:text-ink"
                aria-label="Editar ficha"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCerrar}
              className="inline-flex size-11 items-center justify-center rounded-lg text-label-2 hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {editando ? (
            <FormularioFicha
              bebida={bebida}
              categoriaInicial={categoriaInicial}
              ordenNuevo={ordenNuevo}
              onCancelar={() => (bebida ? setEditando(false) : onCerrar())}
              onGuardada={(b) => {
                onGuardada(b);
                setEditando(false);
              }}
            />
          ) : bebida ? (
            <article className="space-y-4">
              <FotoBotella
                fotoUrl={bebida.fotoUrl}
                nombre={bebida.nombre}
                categoria={bebida.categoria}
                className="mx-auto h-72 w-full max-w-xs rounded-xl sm:h-80"
                iconoClassName="h-14 w-14"
              >
                {esAdmin ? (
                  <button
                    type="button"
                    onClick={() => inputFoto.current?.click()}
                    disabled={subiendo}
                    className="absolute bottom-2 right-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/75 px-3 text-xs font-medium text-[#fff] backdrop-blur"
                  >
                    {subiendo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Camera className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {bebida.fotoUrl ? "Cambiar foto" : "Subir foto"}
                  </button>
                ) : null}
              </FotoBotella>
              <input
                ref={inputFoto}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void subirFoto(e.target.files?.[0])}
              />
              {errorFoto ? (
                <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
                  {errorFoto}
                </p>
              ) : null}

              <header className="space-y-2">
                <h2 className="font-display text-[1.7rem] font-medium leading-tight text-ink">{bebida.nombre}</h2>
                {bebida.precio ? <p className="font-mono text-sm text-seal">{bebida.precio}</p> : null}
                {bebida.meta ? <p className="text-sm text-label-2">{bebida.meta}</p> : null}
                <Etiquetas bebida={bebida} />
              </header>

              {bebida.enSala ? (
                <section className="rounded-xl border border-seal/40 bg-seal/10 px-4 py-3">
                  <h3 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-seal">En sala</h3>
                  <p className="text-[0.95rem] leading-relaxed text-ink first-letter:uppercase">
                    <Md texto={bebida.enSala} />
                  </p>
                </section>
              ) : null}

              {bebida.datos.length > 0 ? (
                <ul className="list-disc space-y-2.5 pl-5 text-[0.95rem] leading-relaxed text-label-2 marker:text-seal">
                  {bebida.datos.map((dato, i) => (
                    <li key={i}>
                      <Md texto={dato} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
        </div>

        {!editando && (onAnterior || onSiguiente) ? (
          <div className="flex gap-2 border-t border-separator px-3 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
            <button
              type="button"
              onClick={onAnterior}
              disabled={!onAnterior}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-separator text-sm text-label-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Anterior
            </button>
            <button
              type="button"
              onClick={onSiguiente}
              disabled={!onSiguiente}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-separator text-sm text-label-2 disabled:opacity-30"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
