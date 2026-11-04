"use client";

import { useState, useEffect } from "react";
import { CloudRain, ShieldAlert, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getEmergencyStatusAction, toggleEmergencyStatusAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** El estado de la emergencia climática, igual en todas las pestañas abiertas. */
function useEmergencyState() {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  useEffect(() => {
    getEmergencyStatusAction().then((res) => {
      if (res.success) {
        setIsEmergencyActive(res.active);
        localStorage.setItem("muni-emergency-mode", JSON.stringify(res.active));
        localStorage.setItem("emergency-mode-active", JSON.stringify(res.active));
      }
    });

    const handleStorageChange = () => {
      const updated = localStorage.getItem("muni-emergency-mode") || localStorage.getItem("emergency-mode-active");
      if (updated !== null) setIsEmergencyActive(JSON.parse(updated));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("muni-emergency-toggle", handleStorageChange);
    window.addEventListener("emergency-toggle", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("muni-emergency-toggle", handleStorageChange);
      window.removeEventListener("emergency-toggle", handleStorageChange);
    };
  }, []);

  const applyEmergencyState = (active: boolean) => {
    setIsEmergencyActive(active);
    localStorage.setItem("muni-emergency-mode", JSON.stringify(active));
    localStorage.setItem("emergency-mode-active", JSON.stringify(active));
    window.dispatchEvent(new Event("muni-emergency-toggle"));
    window.dispatchEvent(new Event("emergency-toggle"));
  };

  return { isEmergencyActive, applyEmergencyState };
}

/**
 * El aviso rojo de arriba de todas las pantallas mientras la emergencia está activa.
 * El botón para prenderla o apagarla está en la página de Emergencia climática.
 */
export function EmergencyHeaderWidget() {
  const { isEmergencyActive } = useEmergencyState();
  const [dismissBanner, setDismissBanner] = useState(false);

  if (!isEmergencyActive || dismissBanner) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white py-2 px-4 shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 text-xs font-bold mx-auto">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <span>🚨 Emergencia climática activa</span>
        <span className="hidden md:inline text-white/80 font-normal">|</span>
        <span className="hidden md:inline text-white/90 font-bold">Cuadrillas operativas en territorio</span>
        <Link
          href="/admin/emergency"
          className="bg-white/20 hover:bg-white text-white hover:text-slate-900 px-3 py-1 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
        >
          Ver emergencia climática <ChevronRight className="h-3 w-3" />
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
  );
}

/**
 * Prender o apagar la emergencia climática (solo la conducción), en la página de Emergencia climática.
 * Cambia la app para todos: se pide confirmación.
 */
export function EmergencyToggle() {
  const { isEmergencyActive, applyEmergencyState } = useEmergencyState();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: session } = useSession();
  const canToggle = Boolean(session?.user?.role && MANAGEMENT_ROLES.includes(session.user.role));
  if (!canToggle) return null;

  const toggleEmergency = async () => {
    const nextState = !isEmergencyActive;
    setSaving(true);
    const res = await toggleEmergencyStatusAction(nextState);
    setSaving(false);
    setConfirmOpen(false);
    if (res.success) {
      applyEmergencyState(nextState);
      toast.success(nextState ? "Emergencia climática activada para toda la Secretaría" : "Emergencia climática desactivada");
    } else {
      toast.error(res.error || "No se pudo cambiar la emergencia climática. Probá de nuevo.");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={isEmergencyActive ? "destructive" : "outline"}
        onClick={() => setConfirmOpen(true)}
        className="gap-2"
        aria-label={isEmergencyActive ? "Emergencia climática activa. Desactivar" : "Emergencia climática apagada. Activar"}
      >
        {isEmergencyActive ? <ShieldAlert className="h-4 w-4" /> : <CloudRain className="h-4 w-4" />}
        {isEmergencyActive ? "Desactivar la emergencia" : "Activar la emergencia"}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEmergencyActive ? "¿Desactivar la emergencia climática?" : "¿Activar la emergencia climática?"}
            </DialogTitle>
            <DialogDescription>
              {isEmergencyActive
                ? "Se saca el aviso rojo de emergencia de todas las pantallas, para toda la gente que usa la app."
                : "Aparece un aviso rojo de emergencia arriba de todas las pantallas, para toda la gente que usa la app. Queda registrado en Auditoría con tu nombre."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant={isEmergencyActive ? "default" : "destructive"} onClick={toggleEmergency} disabled={saving}>
              {saving ? "Guardando…" : isEmergencyActive ? "Sí, desactivar" : "Sí, activar para todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
