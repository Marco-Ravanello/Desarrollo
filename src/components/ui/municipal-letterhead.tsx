"use client";

import React from "react";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";
import type { MunicipalSettings } from "@/types/settings";
import { MunicipalCrest } from "./municipal-crest";
import { PrintBrandStrip } from "./print-layout";

export function MunicipalLetterhead({
  department,
  direction,
  preview
}: {
  department?: string;
  direction?: string;
  /** Datos sin guardar todavía, para la vista previa de Configuración. */
  preview?: Pick<MunicipalSettings, "municipalityName" | "provinceName" | "secretariatName" | "directionName">;
}) {
  const saved = useMunicipalSettings();
  const settings = preview ?? saved;

  const currentDept = department || settings.secretariatName;
  const currentDir = direction || settings.directionName;

  return (
    // Mismo membrete institucional que sale al imprimir: franja azul y naranja, escudo y nombres en azul.
    <div className="print-colors relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card">
      <PrintBrandStrip className="rounded-none" />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <MunicipalCrest className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muni-ochre dark:text-muni-orange">
              {settings.municipalityName.toUpperCase()} • {settings.provinceName.toUpperCase()}
            </p>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-muni-blue dark:text-muni-softblue">
              {currentDept}
            </h2>
            <p className="text-xs text-muted-foreground font-semibold">
              {currentDir}
            </p>
          </div>
        </div>
        <div className="text-center sm:text-right">
          <span className="inline-block rounded-lg border border-muni-blue/40 border-l-4 border-l-muni-orange bg-secondary px-3 py-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
            Documento municipal
          </span>
        </div>
      </div>
    </div>
  );
}
