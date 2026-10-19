"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearOfflineCache } from "@/lib/emergency-offline";
import { idleStateAt } from "@/lib/inactivity";
import { isEmergencySurveyor } from "@/lib/permissions";

// Cierra la sesión si nadie usa la app durante un rato, para que una computadora
// compartida no quede abierta con datos personales. Un minuto antes avisa.
// La última actividad se comparte entre pestañas (localStorage), así usar una
// pestaña mantiene abiertas las demás.

const STORAGE_KEY = "muni-ultima-actividad";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;

function readLastActivity(): number | null {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeLastActivity(t: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(t));
  } catch {}
}

export function InactivityLogout() {
  const { data: session, status } = useSession();
  // El relevador de emergencia trabaja en la calle, con fichas que esperan conexión: no se lo desconecta.
  const enabled = status === "authenticated" && !isEmergencySurveyor(session?.user?.role);
  const lastActivity = useRef(Date.now());
  const loggingOut = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const logout = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    clearOfflineCache().finally(() => signOut({ callbackUrl: "/login?motivo=inactividad" }));
  }, []);

  const markActive = useCallback(() => {
    const now = Date.now();
    // Se guarda como mucho una vez cada 5 segundos para no escribir en cada movimiento del mouse.
    if (now - lastActivity.current < 5000) return;
    lastActivity.current = now;
    writeLastActivity(now);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Si se volvió a abrir el navegador después de mucho tiempo sin uso, se cierra enseguida.
    const stored = readLastActivity();
    if (stored && idleStateAt(Date.now(), stored).expired) {
      logout();
      return;
    }
    lastActivity.current = Date.now();
    writeLastActivity(lastActivity.current);

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const timer = window.setInterval(() => {
      const last = Math.max(lastActivity.current, readLastActivity() ?? 0);
      lastActivity.current = last;
      const state = idleStateAt(Date.now(), last);
      if (state.expired) logout();
      else setSecondsLeft(state.warning ? Math.ceil(state.remainingMs / 1000) : null);
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      window.clearInterval(timer);
    };
  }, [enabled, logout, markActive]);

  const keepWorking = () => {
    lastActivity.current = Date.now();
    writeLastActivity(lastActivity.current);
    setSecondsLeft(null);
  };

  if (!enabled || secondsLeft === null) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && keepWorking()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> ¿Seguís ahí?
          </DialogTitle>
          <DialogDescription>
            Hace un rato que no se usa la app. Por seguridad, la sesión se cierra en{" "}
            <b className="text-foreground">{secondsLeft} segundos</b>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={logout} className="rounded-xl font-bold">Cerrar sesión</Button>
          <Button onClick={keepWorking} className="rounded-xl font-bold">Seguir trabajando</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
