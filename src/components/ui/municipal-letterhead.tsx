"use client";

import React, { useState, useEffect } from "react";
import { MunicipalCrest } from "./municipal-crest";
import { Badge } from "@/components/ui/badge";

export function MunicipalLetterhead({
  department,
  direction,
  showWatermark = false
}: {
  department?: string;
  direction?: string;
  showWatermark?: boolean;
}) {
  const [settings, setSettings] = useState({
    municipalityName: "Municipalidad de Tres de Febrero",
    provinceName: "Provincia de Buenos Aires • República Argentina",
    secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
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

  const currentDept = department || settings.secretariatName;
  const currentDir = direction || settings.directionName;

  return (
    <div className="border-b border-border/80 pb-4 mb-6 bg-card/40 p-5 rounded-3xl relative overflow-hidden">
      {showWatermark && (
        <div className="absolute -right-8 -top-8 opacity-5 pointer-events-none">
          <MunicipalCrest className="h-48 w-48" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 shrink-0">
            <MunicipalCrest className="h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              {settings.municipalityName.toUpperCase()} • {settings.provinceName.toUpperCase()}
            </p>
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight">
              {currentDept}
            </h2>
            <p className="text-xs text-muted-foreground font-semibold">
              {currentDir}
            </p>
          </div>
        </div>
        <div className="text-center sm:text-right space-y-1">
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-background/80 border-border/80">
            Sistema Oficial MuniGestión
          </Badge>
          <p className="text-[10px] text-muted-foreground font-mono">
            Documento de Validez Institucional
          </p>
        </div>
      </div>
    </div>
  );
}
