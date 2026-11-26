"use client";

import { Boton, EsqueletoLista, Pantalla, Segmentado } from "@/app/ui";
import {
  BookOpen,
  CircleAlert,
  GraduationCap,
  Plus,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CATEGORIAS_GUIA,
  fetchGuiaCompleta,
  labelCategoria,
  normalizarBusqueda,
  type CategoriaGuia,
  type GuiaBebida,
  type GuiaCompleta,
} from "@/src/lib/guia-bebidas";

import { Etiquetas, FichaBebida } from "./ficha";
import { Procesos } from "./procesos";
import { Repaso } from "./repaso";
import { Bloques, FotoBotella, Md } from "./ui";

type Modo = "estudiar" | "machete" | "repasar";

const MODOS: { id: Modo; label: string; icono: typeof BookOpen }[] = [
  { id: "estudiar", label: "Estudiar", icono: BookOpen },
  { id: "machete", label: "Machete", icono: Zap },
  { id: "repasar", label: "Repasar", icono: GraduationCap },
];

const MODO_STORAGE_KEY = "omakase_guia_bebidas_modo";

type SeccionEstudio = "elaboracion" | "glosario" | CategoriaGuia;

function Chip(props: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.activo}
      className={`min-h-10 shrink-0 rounded-full px-3.5 text-[0.92rem] transition active:scale-95 ${
        props.activo
          ? "bg-accent-soft font-semibold text-accent"
          : "bg-fill text-label-2"
      }`}
    >
      {props.children}
    </button>
  );
}

function FilaChips(props: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {props.children}
    </div>
  );
}

/** Agrupa por subgrupo respetando el orden de la carta. */
function porSubgrupo(
  bebidas: GuiaBebida[],
): { subgrupo: string | null; bebidas: GuiaBebida[] }[] {
  const grupos: { subgrupo: string | null; bebidas: GuiaBebida[] }[] = [];
  bebidas.forEach((b) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.subgrupo === b.subgrupo) {
      ultimo.bebidas.push(b);
    } else {
      grupos.push({ subgrupo: b.subgrupo, bebidas: [b] });
    }
  });
  return grupos;
}

function Estudiar(props: {
  guia: GuiaCompleta;
  visibles: GuiaBebida[];
  onAbrir: (bebida: GuiaBebida, lista: GuiaBebida[]) => void;
}) {
  const { guia, visibles, onAbrir } = props;
  const [seccion, setSeccion] = useState<SeccionEstudio>("elaboracion");
  const [filtroGlosario, setFiltroGlosario] = useState("");

  const glosarioPorArea = useMemo(() => {
    const q = normalizarBusqueda(filtroGlosario.trim());
    const areas: { area: string; terminos: GuiaCompleta["glosario"] }[] = [];
    guia.glosario
      .filter(
        (g) =>
          !q || normalizarBusqueda(`${g.termino} ${g.definicion}`).includes(q),
      )
      .forEach((g) => {
        const ultimo = areas[areas.length - 1];
        if (ultimo && ultimo.area === g.area) {
          ultimo.terminos.push(g);
        } else {
          areas.push({ area: g.area, terminos: [g] });
        }
      });
    return areas;
  }, [guia, filtroGlosario]);

  const esCategoria = seccion !== "glosario" && seccion !== "elaboracion";
  const deCategoria = esCategoria
    ? visibles.filter((b) => b.categoria === seccion)
    : [];
  const intro = guia.capitulos.find((c) => c.slug === `intro-${seccion}`);

  return (
    <div className="space-y-5">
      <FilaChips>
        <Chip
          activo={seccion === "elaboracion"}
          onClick={() => setSeccion("elaboracion")}
        >
          Elaboración
        </Chip>
        {CATEGORIAS_GUIA.map((c) => (
          <Chip
            key={c.id}
            activo={seccion === c.id}
            onClick={() => setSeccion(c.id)}
          >
            {c.label}
          </Chip>
        ))}
        <Chip
          activo={seccion === "glosario"}
          onClick={() => setSeccion("glosario")}
        >
          Glosario
        </Chip>
      </FilaChips>

      {seccion === "glosario" ? (
        <div className="space-y-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-3"
              aria-hidden
            />
            <input
              type="search"
              value={filtroGlosario}
              onChange={(e) => setFiltroGlosario(e.target.value)}
              placeholder="Buscar un término"
              aria-label="Buscar en el glosario"
              className="min-h-12 w-full rounded-control bg-fill pl-10 pr-3.5 text-[1rem] text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2"
            />
          </div>
          {glosarioPorArea.length === 0 ? (
            <p className="text-sm text-label-3">Ningún término coincide.</p>
          ) : null}
          {glosarioPorArea.map((grupo) => (
            <section key={grupo.area}>
              <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-label-3">
                {grupo.area}
              </h2>
              <dl className="divide-y divide-separator rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                {grupo.terminos.map((t) => (
                  <div key={t.id} className="px-4 py-3">
                    <dt className="font-medium text-ink">{t.termino}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-label-2">
                      <Md texto={t.definicion} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : null}

      {seccion === "elaboracion" ? <Procesos /> : null}

      {esCategoria ? (
        <div className="space-y-6">
          {intro ? (
            <div className="rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] px-4 py-4">
              <Bloques bloques={intro.bloques} />
            </div>
          ) : null}
          {porSubgrupo(deCategoria).map((grupo) => (
            <section key={grupo.subgrupo ?? "sin-grupo"}>
              {grupo.subgrupo ? (
                <h2 className="mb-3 flex items-center gap-3 font-display text-xl font-medium text-ink">
                  {grupo.subgrupo}
                  <span className="h-px flex-1 bg-fill-strong" />
                </h2>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {grupo.bebidas.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onAbrir(b, deCategoria)}
                    className={`flex flex-col overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] text-left transition hover:border-fill-strong ${
                      b.activa ? "" : "opacity-50"
                    }`}
                  >
                    <FotoBotella
                      fotoUrl={b.fotoUrl}
                      nombre={b.nombre}
                      categoria={b.categoria}
                      className="h-44 w-full border-0"
                      iconoClassName="h-10 w-10"
                    />
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="font-display text-[1.05rem] font-medium leading-tight text-ink">
                        {b.nombre}
                      </p>
                      {b.precio ? (
                        <p className="font-mono text-[0.7rem] text-seal">
                          {b.precio}
                        </p>
                      ) : null}
                      {b.meta ? (
                        <p className="line-clamp-2 text-xs leading-snug text-label-3">
                          {b.meta}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Machete(props: {
  visibles: GuiaBebida[];
  esAdmin: boolean;
  onAbrir: (bebida: GuiaBebida, lista: GuiaBebida[]) => void;
  onNueva: (categoria: CategoriaGuia) => void;
}) {
  const { visibles, esAdmin, onAbrir, onNueva } = props;
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGuia | "todas">("todas");

  const indice = useMemo(
    () =>
      visibles.map((b) => ({
        bebida: b,
        texto: normalizarBusqueda(
          [b.nombre, b.meta, b.subgrupo, b.precio, b.enSala, ...b.datos]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [visibles],
  );

  const resultado = useMemo(() => {
    const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
    return indice
      .filter(
        ({ bebida }) => categoria === "todas" || bebida.categoria === categoria,
      )
      .filter(({ texto }) => palabras.every((p) => texto.includes(p)))
      .map(({ bebida }) => bebida);
  }, [indice, busqueda, categoria]);

  return (
    <div className="space-y-4">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-4 space-y-3 bg-surface/90 px-4 pb-2 pt-2 backdrop-blur-xl sm:top-[4.75rem] sm:mx-0 sm:px-0">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-label-3"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Botella, productor, uva, zona…"
            aria-label="Buscar en la carta"
            className="min-h-12 w-full rounded-control bg-fill pl-10 pr-12 text-[1rem] text-label outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2"
          />
          {busqueda ? (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Borrar búsqueda"
              className="absolute right-0 top-0 inline-flex size-12 items-center justify-center text-label-3"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <FilaChips>
          <Chip
            activo={categoria === "todas"}
            onClick={() => setCategoria("todas")}
          >
            Todo
          </Chip>
          {CATEGORIAS_GUIA.map((c) => (
            <Chip
              key={c.id}
              activo={categoria === c.id}
              onClick={() => setCategoria(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </FilaChips>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-label-3">
          {resultado.length} {resultado.length === 1 ? "bebida" : "bebidas"}
        </p>
        {esAdmin ? (
          <Boton
            variante="terciario"
            tamano="chico"
            icono={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => onNueva(categoria === "todas" ? "sake" : categoria)}
          >
            Nueva bebida
          </Boton>
        ) : null}
      </div>

      {resultado.length === 0 ? (
        <p className="rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] px-4 py-6 text-center text-sm text-label-2">
          Nada coincide con esa búsqueda. Probá con menos palabras o cambiá de
          categoría.
        </p>
      ) : (
        <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          {resultado.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onAbrir(b, resultado)}
                className={`flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-fill ${
                  b.activa ? "" : "opacity-50"
                }`}
              >
                <FotoBotella
                  fotoUrl={b.fotoUrl}
                  nombre={b.nombre}
                  categoria={b.categoria}
                  className="h-20 w-14 shrink-0 rounded-md"
                  iconoClassName="h-5 w-5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-[1.1rem] font-medium leading-tight text-ink">
                      {b.nombre}
                    </p>
                    {b.precio ? (
                      <p className="shrink-0 font-mono text-[0.7rem] text-seal">
                        {b.precio.split(" / ")[0]}
                      </p>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-label-3">
                    {categoria === "todas"
                      ? `${labelCategoria(b.categoria)} · `
                      : ""}
                    {b.meta ?? b.subgrupo}
                  </p>
                  {b.enSala ? (
                    <p className="line-clamp-2 text-sm leading-snug text-label-2 first-letter:uppercase">
                      <Md texto={b.enSala} />
                    </p>
                  ) : null}
                  <Etiquetas bebida={b} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GuiaBebidasPage() {
  const [guia, setGuia] = useState<GuiaCompleta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [modo, setModo] = useState<Modo>("estudiar");
  const [abierta, setAbierta] = useState<{
    id: string;
    lista: string[];
  } | null>(null);
  const [nueva, setNueva] = useState<CategoriaGuia | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetchGuiaCompleta()
      .then((data) => {
        if (!cancelado) setGuia(data);
      })
      .catch((e: unknown) => {
        if (!cancelado)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la guía.",
          );
      });
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { session: { role: string } | null }) => {
        if (!cancelado) setEsAdmin(data.session?.role === "admin");
      })
      .catch(() => undefined);
    const timer = window.setTimeout(() => {
      try {
        const guardado = window.localStorage.getItem(MODO_STORAGE_KEY);
        if (guardado === "machete" || guardado === "repasar") setModo(guardado);
      } catch {
        // sin localStorage: queda el modo por defecto
      }
    }, 0);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, []);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    try {
      window.localStorage.setItem(MODO_STORAGE_KEY, m);
    } catch {
      // sin localStorage
    }
  };

  /** El equipo ve solo lo que está en carta; admin ve también lo dado de baja (atenuado). */
  const visibles = useMemo(
    () => (guia ? guia.bebidas.filter((b) => esAdmin || b.activa) : []),
    [guia, esAdmin],
  );

  const abrir = useCallback((bebida: GuiaBebida, lista: GuiaBebida[]) => {
    setAbierta({ id: bebida.id, lista: lista.map((b) => b.id) });
  }, []);
  const cerrar = useCallback(() => {
    setAbierta(null);
    setNueva(null);
  }, []);

  const guardada = useCallback((bebida: GuiaBebida) => {
    setGuia((actual) => {
      if (!actual) return actual;
      const existe = actual.bebidas.some((b) => b.id === bebida.id);
      const bebidas = existe
        ? actual.bebidas.map((b) => (b.id === bebida.id ? bebida : b))
        : [...actual.bebidas, bebida];
      return { ...actual, bebidas };
    });
    setNueva(null);
    setAbierta((a) => a ?? { id: bebida.id, lista: [bebida.id] });
  }, []);

  const bebidaAbierta =
    abierta && guia
      ? (guia.bebidas.find((b) => b.id === abierta.id) ?? null)
      : null;
  const posicion = abierta ? abierta.lista.indexOf(abierta.id) : -1;
  const mover = (delta: number) => {
    if (!abierta) return undefined;
    const destino = abierta.lista[posicion + delta];
    return destino ? () => setAbierta({ ...abierta, id: destino }) : undefined;
  };
  const ordenNuevo = guia
    ? Math.max(0, ...guia.bebidas.map((b) => b.orden)) + 1
    : 1;

  return (
    <Pantalla
      titulo="Guía de bebidas"
      subtitulo="Para estudiar, consultar en servicio y repasar"
      ayuda={
        <>
          <p>
            <strong className="text-label">Estudiar</strong>: cómo se elabora
            cada bebida, las fichas por categoría y el glosario.
          </p>
          <p>
            <strong className="text-label">Machete</strong>: buscador rápido
            para el servicio, con la línea «En sala» de cada botella a la vista.
          </p>
          <p>
            <strong className="text-label">Repasar</strong>: tarjetas para
            practicar; las falladas vuelven a salir.
          </p>
        </>
      }
    >
      <div className="mb-5">
        <Segmentado<Modo>
          etiqueta="Modo"
          valor={modo}
          onChange={cambiarModo}
          opciones={MODOS.map((m) => {
            const Icono = m.icono;
            return {
              valor: m.id,
              label: (
                <>
                  <Icono className="h-4 w-4" aria-hidden />
                  {m.label}
                </>
              ),
            };
          })}
        />
      </div>

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

      {!guia && !error ? <EsqueletoLista filas={6} /> : null}

      {guia ? (
        <>
          {modo === "estudiar" ? (
            <Estudiar guia={guia} visibles={visibles} onAbrir={abrir} />
          ) : null}
          {modo === "machete" ? (
            <Machete
              visibles={visibles}
              esAdmin={esAdmin}
              onAbrir={abrir}
              onNueva={setNueva}
            />
          ) : null}
          {modo === "repasar" ? <Repaso guia={guia} /> : null}
        </>
      ) : null}

      {bebidaAbierta || nueva ? (
        <FichaBebida
          key={bebidaAbierta?.id ?? "nueva"}
          bebida={bebidaAbierta}
          esAdmin={esAdmin}
          categoriaInicial={nueva ?? "sake"}
          ordenNuevo={ordenNuevo}
          onCerrar={cerrar}
          onAnterior={bebidaAbierta ? mover(-1) : undefined}
          onSiguiente={bebidaAbierta ? mover(1) : undefined}
          onGuardada={guardada}
        />
      ) : null}
    </Pantalla>
  );
}
