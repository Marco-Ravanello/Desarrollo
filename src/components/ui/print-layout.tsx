"use client";

import React, { useState, useEffect } from "react";
import { MunicipalCrest } from "./municipal-crest";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatFechaHora } from "@/lib/fechas";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";

export function PrintHeader({
  documentTitle,
  documentSubtitle,
  referenceNumber
}: {
  documentTitle?: string;
  documentSubtitle?: string;
  referenceNumber?: string;
}) {
  const settings = useMunicipalSettings();
  // La hora de emisión se pone en el navegador, al abrir la pantalla.
  const [currentDate, setCurrentDate] = useState("");
  useEffect(() => setCurrentDate(formatFechaHora(new Date())), []);

  return (
    // print-default-header: una página con su propio membrete (por ejemplo, un certificado) puede ocultarlo.
    // Membrete institucional: franja azul y naranja, escudo y nombres en el azul de la Municipalidad.
    <div className="print-default-header print-colors hidden print:flex flex-col w-full mb-6 text-slate-900">
      <PrintBrandStrip />
      <div className="flex items-center justify-between pt-4 pb-3">
        <div className="flex items-center gap-3">
          <MunicipalCrest className="h-14 w-14" forceDefault />
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#A8590A]">
              {settings.municipalityName.toUpperCase()} • {settings.provinceName.toUpperCase()}
            </p>
            <h1 className="text-base font-bold uppercase tracking-tight text-[#163C68]">
              {settings.secretariatName}
            </h1>
            <p className="text-[11px] font-semibold text-[#2F4054]">
              {settings.directionName}
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="inline-block rounded-lg border border-[#163C68] border-l-4 border-l-[#F69321] bg-[#E0EEFF] px-3 py-1 font-bold text-xs text-[#163C68] tabular-nums">
            {referenceNumber ? `REF: ${referenceNumber}` : "DOCUMENTO OFICIAL"}
          </div>
          {currentDate && (
            <p className="text-[10px] text-slate-500 mt-1">Emisión: {currentDate} hs</p>
          )}
        </div>
      </div>
      <div className="h-px w-full bg-[#163C68]/30" />

      {(documentTitle || documentSubtitle) && (
        <div className="mt-3 flex justify-between items-end">
          <div>
            {documentTitle && (
              <h2 className="text-lg font-bold uppercase tracking-tight text-[#163C68]">
                {documentTitle}
              </h2>
            )}
            {documentSubtitle && (
              <p className="text-xs text-slate-600 font-medium">
                {documentSubtitle}
              </p>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Documento municipal
          </span>
        </div>
      )}
    </div>
  );
}

/** Franja azul y naranja de la Municipalidad, arriba del membrete y abajo del pie. */
export function PrintBrandStrip({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex h-1.5 w-full overflow-hidden rounded-full ${className}`}>
      <span className="h-full flex-[4] bg-[#163C68]" />
      <span className="h-full flex-1 bg-[#F69321]" />
    </div>
  );
}

export function PrintFooter() {
  const settings = useMunicipalSettings();

  return (
    // print-default-footer: una página con sus propias firmas (por ejemplo, una constancia) puede ocultarlo.
    <div className="print-default-footer print-colors hidden print:flex flex-col w-full mt-12 pt-6 border-t border-[#163C68]/30 text-slate-900 break-inside-avoid">
      <div className="grid grid-cols-2 gap-12 pt-8 pb-4">
        <div className="text-center space-y-1">
          <div className="border-t border-slate-400 w-48 mx-auto mb-1" />
          <p className="text-xs font-bold uppercase text-[#163C68]">Firma y sello del agente</p>
          <p className="text-[10px] text-slate-500">{settings.directionName}</p>
        </div>
        <div className="text-center space-y-1">
          <div className="border-t border-slate-400 w-48 mx-auto mb-1" />
          <p className="text-xs font-bold uppercase text-[#163C68]">Firma de quien recibe</p>
          <p className="text-[10px] text-slate-500">Conformidad del trámite</p>
        </div>
      </div>

      <PrintBrandStrip className="mt-4" />
      <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2">
        <span>{settings.municipalityName} • Plataforma MuniGestión • Contiene datos personales protegidos por la Ley 25.326.</span>
        <span className="font-bold text-[#163C68]">MuniGestión 3F</span>
      </div>
    </div>
  );
}

export function PrintButton({
  className = "",
  label = "Imprimir"
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      className={`print:hidden rounded-2xl h-11 px-5 font-bold text-xs border-border/60 hover:bg-muted shadow-xs flex items-center gap-2 ${className}`}
      title="Imprimir documento oficial en formato A4 (Ctrl + P)"
    >
      <Printer className="h-4 w-4 text-primary" />
      <span>{label}</span>
      <kbd className="hidden sm:inline-block text-[10px] tabular-nums bg-muted px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground">
        Ctrl+P
      </kbd>
    </Button>
  );
}
