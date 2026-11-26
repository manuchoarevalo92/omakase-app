"use client";

import { Archive, Bell, Fish, Plus, Share, Trash2, Wine } from "lucide-react";
import { useState } from "react";

import {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  CampoBusqueda,
  Contador,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fecha,
  Fila,
  Interruptor,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
  useAvisos,
} from "@/app/ui";

/** Muestrario interno del sistema de diseño (solo admin). Referencia al migrar pantallas. */
export default function DisenoPage() {
  const { aviso, confirmar } = useAvisos();
  const [vista, setVista] = useState<"lista" | "editar" | "resumen">("lista");
  const [cantidad, setCantidad] = useState(3);
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("sv-SE"),
  );
  const [proveedor, setProveedor] = useState<string | null>("nishikidori");
  const [urgente, setUrgente] = useState(true);
  const [filas, setFilas] = useState([
    "Atún akami",
    "Hamachi",
    "Uni de Hokkaido",
  ]);

  const borrar = (nombre: string) => {
    const antes = filas;
    setFilas((f) => f.filter((x) => x !== nombre));
    aviso(`${nombre} borrado`, { deshacer: () => setFilas(antes) });
  };

  return (
    <Pantalla
      titulo="Diseño"
      subtitulo="Muestrario de componentes"
      ayuda={
        <>
          <p>
            Esta pantalla muestra todas las piezas del sistema de diseño en el
            tema actual.
          </p>
          <p>
            Las instrucciones de cada pantalla van acá, detrás del botón «?», y
            no en el encabezado.
          </p>
        </>
      }
      acciones={
        <BotonIcono
          etiqueta="Agregar"
          icono={<Plus className="h-[22px] w-[22px]" aria-hidden />}
        />
      }
    >
      <Seccion titulo="Segmentado">
        <Segmentado
          etiqueta="Vista"
          valor={vista}
          onChange={setVista}
          opciones={[
            { valor: "lista", label: "Lista" },
            { valor: "editar", label: "Editar" },
            { valor: "resumen", label: "Resumen" },
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Lista"
        pie="Deslizá una fila hacia la izquierda para ver sus acciones."
      >
        <Lista>
          {filas.map((f) => (
            <Fila
              key={f}
              icono={
                <span className="flex size-8 items-center justify-center rounded-[0.6rem] bg-info-soft text-info">
                  <Fish className="h-[18px] w-[18px]" aria-hidden />
                </span>
              }
              titulo={f}
              detalle="Nishikidori · 2 kg"
              valor={
                <Etiqueta tono={f === "Hamachi" ? "alerta" : "exito"}>
                  {f === "Hamachi" ? "Pedir" : "OK"}
                </Etiqueta>
              }
              onClick={() => aviso(`Abrir ${f}`)}
              acciones={[
                {
                  label: "Archivar",
                  tono: "neutro",
                  icono: <Archive className="h-5 w-5" aria-hidden />,
                  onClick: () => aviso(`${f} archivado`),
                },
                {
                  label: "Borrar",
                  tono: "peligro",
                  icono: <Trash2 className="h-5 w-5" aria-hidden />,
                  onClick: () => borrar(f),
                },
              ]}
            />
          ))}
        </Lista>
      </Seccion>

      <Seccion titulo="Campos">
        <div className="space-y-4">
          <CampoBusqueda placeholder="Buscar ítem" />
          <Campo
            label="Nombre"
            placeholder="Ej. Wasabi fresco"
            ayuda="Como figura en el albarán."
          />
          <Campo
            label="Precio"
            inputMode="decimal"
            defaultValue="12,5"
            error="Usá punto o coma, sin el símbolo €."
          />
          <Selector
            label="Proveedor"
            titulo="Proveedor"
            valor={proveedor}
            onChange={setProveedor}
            buscar
            opciones={[
              {
                valor: "nishikidori",
                label: "Nishikidori",
                detalle: "Pescado y marisco",
                grupo: "Habituales",
              },
              {
                valor: "isse",
                label: "Isse Japan",
                detalle: "Despensa japonesa",
                grupo: "Habituales",
              },
              {
                valor: "cominport",
                label: "Cominport",
                detalle: "Congelados",
                grupo: "Habituales",
              },
              {
                valor: "makro",
                label: "Makro",
                detalle: "Varios",
                grupo: "Otros",
              },
              {
                valor: "amazon",
                label: "Amazon",
                detalle: "Insumos",
                grupo: "Otros",
              },
            ]}
          />
          <Fecha label="Fecha del servicio" valor={fecha} onChange={setFecha} />
          <AreaTexto label="Nota" placeholder="Algo para el equipo…" />
        </div>
      </Seccion>

      <Seccion titulo="Cantidad e interruptor">
        <Lista>
          <li className="flex min-h-14 items-center justify-between gap-3 border-b border-separator px-4">
            <span className="text-[1rem]">Cajas</span>
            <Contador
              etiqueta="Cajas"
              valor={cantidad}
              onChange={setCantidad}
              unidad="u"
            />
          </li>
          <li className="flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="text-[1rem]">Urgente</span>
            <Interruptor
              etiqueta="Urgente"
              activo={urgente}
              onChange={setUrgente}
            />
          </li>
        </Lista>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="space-y-2">
          <Boton
            ancho
            tamano="grande"
            icono={<Share className="h-[18px] w-[18px]" aria-hidden />}
            onClick={() => aviso("Pedido enviado", { tono: "exito" })}
          >
            Enviar pedido
          </Boton>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario">Secundario</Boton>
            <Boton variante="terciario">Terciario</Boton>
          </div>
          <Boton
            ancho
            variante="peligro"
            icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
            onClick={async () => {
              const ok = await confirmar({
                titulo: "¿Borrar todas las líneas?",
                texto: "Se vacía la lista de Cominport. No se puede deshacer.",
                confirmar: "Borrar todas",
                peligro: true,
              });
              aviso(ok ? "Lista vaciada" : "No se borró nada", {
                tono: ok ? "exito" : "neutro",
              });
            }}
          >
            Borrar todas
          </Boton>
          <Boton ancho variante="secundario" cargando>
            Guardando
          </Boton>
        </div>
      </Seccion>

      <Seccion titulo="Etiquetas">
        <div className="flex flex-wrap gap-2">
          <Etiqueta>Neutro</Etiqueta>
          <Etiqueta tono="acento">Acento</Etiqueta>
          <Etiqueta tono="exito">OK</Etiqueta>
          <Etiqueta tono="alerta">Pedir pronto</Etiqueta>
          <Etiqueta tono="peligro">Atrasado</Etiqueta>
          <Etiqueta
            tono="info"
            icono={<Wine className="h-3.5 w-3.5" aria-hidden />}
          >
            Sake
          </Etiqueta>
        </div>
      </Seccion>

      <Seccion titulo="Cargando">
        <EsqueletoLista filas={3} />
      </Seccion>

      <Seccion titulo="Estado vacío">
        <Lista>
          <li>
            <EstadoVacio
              icono={<Bell className="h-6 w-6" aria-hidden />}
              titulo="Sin avisos pendientes"
              texto="Cuando algo se esté por acabar, cargalo acá y queda para que alguien lo pida."
              accion={
                <Boton
                  icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                >
                  Nuevo aviso
                </Boton>
              }
            />
          </li>
        </Lista>
      </Seccion>
    </Pantalla>
  );
}
