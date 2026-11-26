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
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 transition hover:bg-fill-strong active:scale-95"
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
