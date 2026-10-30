"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SECTION_TONE_CLASSES, sectionToneForPath } from "@/lib/secciones";

/** Cuadradito del ícono del encabezado, con el color de la sección del menú en la que está la pantalla. */
export function PageHeaderIcon({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const tone = SECTION_TONE_CLASSES[sectionToneForPath(pathname)];
  return (
    <div className={cn("hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex", tone.chip)}>
      {children}
    </div>
  );
}
