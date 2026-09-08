"use client";

import React, { useState, useEffect } from "react";
import { MunicipalCrest } from "./municipal-crest";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintHeader({
  documentTitle,
  documentSubtitle,
  referenceNumber
}: {
  documentTitle?: string;
  documentSubtitle?: string;
  referenceNumber?: string;
}) {
  const [currentDate, setCurrentDate] = useState("");
  const [settings, setSettings] = useState({
    municipalityName: "Municipalidad de Tres de Febrero",
    provinceName: "Provincia de Buenos Aires • República Argentina",
    secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
    directionName: "Dirección General de Gestión Social y Hábitat"
  });

  useEffect(() => {
    try {
      const now = new Date();
      setCurrentDate(
        `${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
      );
    } catch (e) {
      setCurrentDate(new Date().toISOString().slice(0, 10));
    }

    const loadLocal = () => {
      const saved = localStorage.getItem("muni-system-settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    };

    loadLocal();
    window.addEventListener("muni-settings-updated", loadLocal);
    return () => window.removeEventListener("muni-settings-updated", loadLocal);
  }, []);

  return (
    <div className="hidden print:flex flex-col w-full border-b-2 border-slate-900 pb-4 mb-6 text-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1 border border-slate-900 rounded-xl">
            <MunicipalCrest className="h-12 w-12 text-slate-900" forceDefault />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-700">
              {settings.municipalityName.toUpperCase()} • {settings.provinceName.toUpperCase()}
            </p>
            <h1 className="text-base font-black uppercase tracking-tight text-slate-900">
              {settings.secretariatName}
            </h1>
            <p className="text-[11px] font-semibold text-slate-600">
              {settings.directionName}
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="border border-slate-900 px-3 py-1 rounded-lg inline-block font-mono font-bold text-xs bg-slate-50">
            {referenceNumber ? `REF: ${referenceNumber}` : "DOCUMENTO OFICIAL"}
          </div>
          {currentDate && (
            <p className="text-[10px] text-slate-500 mt-1">Emisión: {currentDate} hs</p>
          )}
        </div>
      </div>

      {(documentTitle || documentSubtitle) && (
        <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-end">
          <div>
            {documentTitle && (
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
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
            Ficha de Validez Institucional
          </span>
        </div>
      )}
    </div>
  );
}

export function PrintFooter() {
  const [settings, setSettings] = useState({
    municipalityName: "Municipalidad de Tres de Febrero",
    directionName: "Dirección General de Gestión Social y Hábitat"
  });

  useEffect(() => {
    const loadLocal = () => {
      const saved = localStorage.getItem("muni-system-settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    };

    loadLocal();
    window.addEventListener("muni-settings-updated", loadLocal);
    return () => window.removeEventListener("muni-settings-updated", loadLocal);
  }, []);

  return (
    <div className="hidden print:flex flex-col w-full mt-12 pt-6 border-t-2 border-slate-900 text-slate-900 break-inside-avoid">
      <div className="grid grid-cols-2 gap-12 pt-8 pb-4">
        <div className="text-center space-y-1">
          <div className="border-t border-slate-400 w-48 mx-auto mb-1" />
          <p className="text-xs font-black uppercase text-slate-900">Firma y Sello del Agente</p>
          <p className="text-[10px] text-slate-500">{settings.directionName}</p>
        </div>
        <div className="text-center space-y-1">
          <div className="border-t border-slate-400 w-48 mx-auto mb-1" />
          <p className="text-xs font-black uppercase text-slate-900">Firma del Titular / Receptor</p>
          <p className="text-[10px] text-slate-500">Conformidad de Trámite / Notificación</p>
        </div>
      </div>

      <div className="flex justify-between items-center text-[9px] text-slate-500 pt-3 border-t border-slate-200 mt-4">
        <span>{settings.municipalityName} • Plataforma MuniGestión • Documento emitido bajo secreto fiscal y protección de datos (Ley 25.326).</span>
        <span className="font-mono font-bold">Página 1 de 1</span>
      </div>
    </div>
  );
}

export function PrintButton({
  className = "",
  label = "Imprimir Documento Oficial"
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      className={`print:hidden rounded-2xl h-11 px-5 font-bold text-xs border-border/60 hover:bg-accent shadow-xs flex items-center gap-2 ${className}`}
      title="Imprimir documento oficial en formato A4 (Ctrl + P)"
    >
      <Printer className="h-4 w-4 text-primary" />
      <span>{label}</span>
      <kbd className="hidden sm:inline-block text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground">
        Ctrl+P
      </kbd>
    </Button>
  );
}
