"use client";

import { Beer, BottleWine, GlassWater, Martini, Wine } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { BloqueGuia, CategoriaGuia } from "@/src/lib/guia-bebidas";

/** Markdown mínimo de la guía: **negrita** y *cursiva*. */
export function Md(props: { texto: string }) {
  const partes = props.texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {partes.map((parte, i) => {
        if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {parte.slice(2, -2)}
            </strong>
          );
        }
        if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
          return <em key={i}>{parte.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{parte}</Fragment>;
      })}
    </>
  );
}

/** Render de los bloques de un capítulo (títulos, párrafos, listas y tablas). */
export function Bloques(props: { bloques: BloqueGuia[] }) {
  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed text-label-2">
      {props.bloques.map((b, i) => {
        if (b.t === "h") {
          return (
            <h3 key={i} className="pt-3 font-display text-xl font-medium text-ink">
              {b.x}
            </h3>
          );
        }
        if (b.t === "p") {
          return (
            <p key={i}>
              <Md texto={b.x} />
            </p>
          );
        }
        if (b.t === "ul" || b.t === "ol") {
          const Lista = b.t === "ol" ? "ol" : "ul";
          return (
            <Lista
              key={i}
              className={`space-y-2 pl-5 marker:text-seal ${b.t === "ol" ? "list-decimal" : "list-disc"}`}
            >
              {b.items.map((item, j) => (
                <li key={j}>
                  <Md texto={item} />
                </li>
              ))}
            </Lista>
          );
        }
        return (
          <div key={i} className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  {b.head.map((h, j) => (
                    <th
                      key={j}
                      className="border-b border-separator px-2 py-2 text-[0.7rem] font-medium uppercase tracking-wider text-label-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((fila, j) => (
                  <tr key={j} className="align-top">
                    {fila.map((celda, k) => (
                      <td
                        key={k}
                        className={`border-b border-separator px-2 py-2 ${k === 0 ? "font-medium text-ink" : ""}`}
                      >
                        <Md texto={celda} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function IconoCategoria(props: { categoria: CategoriaGuia; className?: string }) {
  const { categoria, className } = props;
  switch (categoria) {
    case "sake":
      return <BottleWine className={className} aria-hidden />;
    case "whisky":
      return <Martini className={className} aria-hidden />;
    case "aperitivo":
      return <Beer className={className} aria-hidden />;
    case "sin-alcohol":
      return <GlassWater className={className} aria-hidden />;
    default:
      return <Wine className={className} aria-hidden />;
  }
}

/**
 * Foto de la botella sobre fondo blanco (las fotos de producto vienen así) o,
 * si todavía no hay foto, el ícono de la categoría.
 */
export function FotoBotella(props: {
  fotoUrl: string | null;
  nombre: string;
  categoria: CategoriaGuia;
  className?: string;
  iconoClassName?: string;
  children?: ReactNode;
}) {
  const { fotoUrl, nombre, categoria, className = "", iconoClassName = "h-8 w-8", children } = props;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${
        fotoUrl ? "bg-[#fff]" : "border border-dashed border-separator bg-fill"
      } ${className}`}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos remotas de Supabase Storage ya reducidas
        <img
          src={fotoUrl}
          alt={`Botella de ${nombre}`}
          loading="lazy"
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <IconoCategoria categoria={categoria} className={`${iconoClassName} text-label-3`} />
      )}
      {children}
    </div>
  );
}
