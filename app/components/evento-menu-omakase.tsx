"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  Boton,
  BotonIcono,
  Campo,
  HojaOpciones,
  Seccion,
  Segmentado,
  Selector,
  cx,
  type OpcionSelector,
} from "@/app/ui";
import {
  contarPasosMenu,
  EVENTO_NIGIRI_BASE,
  EVENTO_OTSUMAMI_REGALO,
  type EventoMenuItem,
  type EventoMenuOmakaseSlots,
} from "@/src/lib/eventos";

type PlatoCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
};

type Props = {
  slots: EventoMenuOmakaseSlots;
  onSlotsChange: (next: EventoMenuOmakaseSlots) => void;
  platos: PlatoCatalogo[];
  extras: EventoMenuItem[];
  isSaving: boolean;
  onGuardarMenu: () => void;
  onAgregarExtra: (platoId: string) => void;
  onAgregarLibre: (nombre: string) => void;
  onQuitarExtra: (item: EventoMenuItem) => void;
  extraPlatoId: string;
  onExtraPlatoIdChange: (id: string) => void;
  extraLibre: string;
  onExtraLibreChange: (v: string) => void;
};

const LISTA =
  "overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

function esDuplicado(lista: string[], index: number, platoId: string): boolean {
  return lista.some(
    (id, i) => i !== index && id === platoId && platoId.length > 0,
  );
}

export function EventoMenuOmakase(props: Props) {
  const {
    slots,
    onSlotsChange,
    platos,
    extras,
    isSaving,
    onGuardarMenu,
    onAgregarExtra,
    onAgregarLibre,
    onQuitarExtra,
    extraPlatoId,
    onExtraPlatoIdChange,
    extraLibre,
    onExtraLibreChange,
  } = props;

  const opciones = useMemo(() => {
    const map = new Map<string, PlatoCatalogo[]>();
    for (const p of platos) {
      const lista = map.get(p.categoria) ?? [];
      lista.push(p);
      map.set(p.categoria, lista);
    }
    return map;
  }, [platos]);

  const nombrePorId = useMemo(
    () => new Map(platos.map((p) => [p.id, p.nombre])),
    [platos],
  );

  const conteo = contarPasosMenu(slots);

  const setPaso = (
    seccion: "otsumami" | "regalo" | "nigiri" | "postre",
    index: number,
    valor: string,
  ) => {
    const lista = [...slots[seccion]];
    lista[index] = valor;
    onSlotsChange({ ...slots, [seccion]: lista });
  };

  const intercambiarNigiri = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= EVENTO_NIGIRI_BASE || j >= EVENTO_NIGIRI_BASE)
      return;
    const lista = [...slots.nigiri];
    const tmp = lista[i];
    lista[i] = lista[j];
    lista[j] = tmp;
    onSlotsChange({ ...slots, nigiri: lista });
  };

  const opcionesDe = (
    categoria: string,
    seccion: string[] | null,
    index: number,
  ): OpcionSelector<string>[] =>
    (opciones.get(categoria) ?? []).map((plato) => ({
      valor: plato.id,
      label: plato.nombre,
      deshabilitada: seccion ? esDuplicado(seccion, index, plato.id) : false,
    }));

  const opcionesExtra: OpcionSelector<string>[] = platos.map((p) => ({
    valor: p.id,
    label: p.nombre,
    grupo: p.categoria,
  }));

  const nombre = (id: string) => (id ? (nombrePorId.get(id) ?? null) : null);
  const completo = conteo.base === conteo.baseObjetivo;

  return (
    <>
      <Segmentado
        etiqueta="Tipo de menú"
        valor={slots.nigiriOnly ? "nigiri" : "clasico"}
        onChange={(v) =>
          onSlotsChange({ ...slots, nigiriOnly: v === "nigiri" })
        }
        opciones={[
          { valor: "clasico", label: "Clásico" },
          { valor: "nigiri", label: "Nigiri only" },
        ]}
      />

      <div className="mt-4 rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[0.94rem] text-label-2">
            <span className="font-semibold tabular-nums text-label">
              {conteo.base}/{conteo.baseObjetivo}
            </span>{" "}
            platos del menú
          </p>
          {!slots.nigiriOnly ? (
            <p className="text-[0.84rem] tabular-nums text-label-3">
              Regalo {conteo.regalo}/{EVENTO_OTSUMAMI_REGALO}
            </p>
          ) : null}
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill"
          role="progressbar"
          aria-label="Platos del menú elegidos"
          aria-valuenow={conteo.base}
          aria-valuemin={0}
          aria-valuemax={conteo.baseObjetivo}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all duration-300",
              completo ? "bg-success" : "bg-accent",
            )}
            style={{
              width: `${conteo.baseObjetivo ? (conteo.base / conteo.baseObjetivo) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {platos.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface-3 px-4 py-4 text-label-2">
          No hay platos en el catálogo.
        </p>
      ) : (
        <>
          {!slots.nigiriOnly ? (
            <>
              <Seccion titulo="Otsumami">
                <ul className={LISTA}>
                  {slots.otsumami.map((valor, index) => (
                    <SlotPlato
                      key={`otsu-${index}`}
                      numero={index + 1}
                      titulo={`Otsumami ${index + 1}`}
                      placeholder="Elegir otsumami"
                      valor={valor}
                      nombre={nombre(valor)}
                      opciones={opcionesDe("Otsumami", slots.otsumami, index)}
                      vaciar="Dejar vacío"
                      onElegir={(id) => setPaso("otsumami", index, id)}
                    />
                  ))}
                </ul>
              </Seccion>

              <Seccion
                titulo="Regalo"
                pie="Opcionales: no cuentan para completar el menú."
              >
                <ul className={LISTA}>
                  {slots.regalo.map((valor, index) => (
                    <SlotPlato
                      key={`regalo-${index}`}
                      numero={index + 1}
                      titulo={`Regalo ${index + 1}`}
                      placeholder="Sin regalo"
                      valor={valor}
                      nombre={nombre(valor)}
                      opciones={opcionesDe("Otsumami", slots.regalo, index)}
                      vaciar="Sin regalo"
                      onElegir={(id) => setPaso("regalo", index, id)}
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
            <ul className={LISTA}>
              {slots.nigiri.map((valor, index) => (
                <SlotPlato
                  key={`nigiri-${index}`}
                  numero={index + 1}
                  titulo={`Nigiri ${index + 1}`}
                  placeholder="Elegir nigiri"
                  valor={valor}
                  nombre={nombre(valor)}
                  opciones={opcionesDe("Nigiri", slots.nigiri, index)}
                  vaciar="Dejar vacío"
                  onElegir={(id) => setPaso("nigiri", index, id)}
                  orden={{
                    subir:
                      index > 0
                        ? () => intercambiarNigiri(index, index - 1)
                        : undefined,
                    bajar:
                      index < EVENTO_NIGIRI_BASE - 1
                        ? () => intercambiarNigiri(index, index + 1)
                        : undefined,
                  }}
                />
              ))}
            </ul>
          </Seccion>

          {!slots.nigiriOnly ? (
            <Seccion titulo="Postre">
              <ul className={LISTA}>
                {slots.postre.map((valor, index) => (
                  <SlotPlato
                    key={`postre-${index}`}
                    titulo="Postre"
                    placeholder="Elegir postre"
                    valor={valor}
                    nombre={nombre(valor)}
                    opciones={opcionesDe("Postre", null, index)}
                    vaciar="Dejar vacío"
                    onElegir={(id) => setPaso("postre", index, id)}
                  />
                ))}
              </ul>
            </Seccion>
          ) : null}

          <Seccion
            titulo={`Extras · ${extras.length}`}
            pie="Opcionales. Se agregan y se quitan al momento, sin guardar el menú."
          >
            {extras.length > 0 ? (
              <ul className={cx(LISTA, "mb-3")}>
                {extras.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-h-14 items-center gap-3 border-b border-separator py-1.5 pl-4 pr-1.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 text-[1rem] leading-snug text-label">
                      {item.platoNombre}
                    </span>
                    <BotonIcono
                      etiqueta={`Quitar ${item.platoNombre}`}
                      variante="plano"
                      disabled={isSaving}
                      icono={
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                      }
                      onClick={() => onQuitarExtra(item)}
                      className="text-danger"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Selector
                    titulo="Plato extra"
                    placeholder="Plato de la carta…"
                    valor={extraPlatoId || null}
                    opciones={opcionesExtra}
                    buscar
                    onChange={onExtraPlatoIdChange}
                  />
                </div>
                <Boton
                  variante="secundario"
                  className="min-h-12"
                  icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => onAgregarExtra(extraPlatoId)}
                  disabled={isSaving || !extraPlatoId}
                >
                  Agregar
                </Boton>
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Campo
                    aria-label="Ítem libre"
                    value={extraLibre}
                    onChange={(e) => onExtraLibreChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && extraLibre.trim() && !isSaving) {
                        e.preventDefault();
                        onAgregarLibre(extraLibre);
                      }
                    }}
                    enterKeyHint="done"
                    placeholder="Ítem libre (ej. sake premium)"
                  />
                </div>
                <Boton
                  variante="secundario"
                  className="min-h-12"
                  icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => onAgregarLibre(extraLibre)}
                  disabled={isSaving || !extraLibre.trim()}
                >
                  Agregar
                </Boton>
              </div>
            </div>
          </Seccion>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 -mx-4 mt-6 px-4 pb-1 sm:bottom-4 sm:mx-0 sm:px-0">
            <Boton
              ancho
              tamano="grande"
              cargando={isSaving}
              disabled={conteo.base === 0}
              icono={<Save className="h-[18px] w-[18px]" aria-hidden />}
              onClick={onGuardarMenu}
              className="shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
            >
              {conteo.base === 0
                ? "Elegí al menos un plato"
                : `Guardar menú · ${conteo.base}/${conteo.baseObjetivo}`}
            </Boton>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Un paso del menú: muestra el plato elegido (o el lugar vacío) y al tocarlo abre
 * la hoja con los platos. Los Nigiri suman flechas para reordenar.
 * (Copia local del patrón de app/page.tsx, que no lo exporta.)
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
        <div className="flex shrink-0 items-center pr-1">
          <button
            type="button"
            disabled={!orden.subir}
            onClick={orden.subir}
            aria-label={`Subir ${titulo}`}
            className="inline-flex size-11 items-center justify-center rounded-full text-label-2 transition active:scale-90 active:bg-fill disabled:opacity-25"
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!orden.bajar}
            onClick={orden.bajar}
            aria-label={`Bajar ${titulo}`}
            className="inline-flex size-11 items-center justify-center rounded-full text-label-2 transition active:scale-90 active:bg-fill disabled:opacity-25"
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
        buscar={opciones.length > 12}
        vaciar={vaciar ? { valor: "", label: vaciar } : undefined}
      />
    </li>
  );
}
