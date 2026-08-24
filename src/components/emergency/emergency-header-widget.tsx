"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CloudRain, AlertTriangle, ShieldAlert, X, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";

export function EmergencyHeaderWidget() {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("emergency-mode-active");
    if (saved) setIsEmergencyActive(JSON.parse(saved));

    const handleStorageChange = () => {
      const updated = localStorage.getItem("emergency-mode-active");
      if (updated) setIsEmergencyActive(JSON.parse(updated));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("emergency-toggle", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("emergency-toggle", handleStorageChange);
    };
  }, []);

  const toggleEmergency = () => {
    const nextState = !isEmergencyActive;
    setIsEmergencyActive(nextState);
    localStorage.setItem("emergency-mode-active", JSON.stringify(nextState));
    window.dispatchEvent(new Event("emergency-toggle"));
  };

  return (
    <div className="flex items-center gap-3">
      {isEmergencyActive && !dismissBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white py-2 px-4 shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-wider mx-auto">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span>🚨 PROTOCOLO DE EMERGENCIA CLIMÁTICA Y TEMPORAL ACTIVO</span>
            <span className="hidden md:inline text-white/80 font-normal">|</span>
            <span className="hidden md:inline text-white/90 font-bold">Centros de Evacuados y Cuadrillas Operativas en Marcha</span>
            <Link
              href="/admin/emergency"
              className="bg-white/20 hover:bg-white text-white hover:text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-1 shadow-sm"
            >
              Ver Centro de Operaciones <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <button
            onClick={() => setDismissBanner(true)}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 text-xs"
            title="Ocultar aviso superior"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        onClick={toggleEmergency}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all border shadow-sm ${
          isEmergencyActive
            ? "bg-rose-500/15 border-rose-500/40 text-rose-500 animate-pulse hover:bg-rose-500/25"
            : "bg-muted/40 hover:bg-muted border-border/60 text-muted-foreground hover:text-foreground"
        }`}
        title={isEmergencyActive ? "Desactivar protocolo de emergencia" : "Activar protocolo de emergencia climática"}
      >
        {isEmergencyActive ? (
          <>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            <span className="hidden sm:inline tracking-wider">MODO CRISIS: ON</span>
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
          </>
        ) : (
          <>
            <CloudRain className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline font-bold">Modo Temporal: OFF</span>
          </>
        )}
      </button>

      {isEmergencyActive && (
        <Link href="/admin/emergency">
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider border-none px-2.5 py-1 hidden sm:inline-flex items-center gap-1 shadow-sm">
            <AlertTriangle className="h-3 w-3" /> Operaciones
          </Badge>
        </Link>
      )}
    </div>
  );
}
