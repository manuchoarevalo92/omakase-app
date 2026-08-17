"use client";

import { Moon, Sun, SunMoon } from "lucide-react";

import { useTema } from "@/app/components/tema-provider";
import { ETIQUETA_TEMA } from "@/src/lib/tema";

export function TemaToggle() {
  const { preferencia, resuelto, cicloPreferencia } = useTema();
  const Icon = preferencia === "auto" ? SunMoon : preferencia === "dia" ? Sun : Moon;
  const titulo =
    preferencia === "auto"
      ? `Tema automático (día 7–20 h). Ahora: ${resuelto === "dia" ? "día" : "noche"}. Tocá para fijar.`
      : `Tema ${ETIQUETA_TEMA[preferencia]}. Tocá para cambiar (Auto / Día / Noche).`;

  return (
    <button
      type="button"
      onClick={cicloPreferencia}
      title={titulo}
      aria-label={titulo}
      className="inline-flex size-10 shrink-0 items-center justify-center border border-ink-200 bg-ink-50 text-ink-400 transition hover:border-ink-400 hover:text-ink"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
