"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, Trash2, FileText, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PENDING_FICHAS_EVENT,
  PendingFicha,
  readPendingFichas,
  removePendingFicha,
  syncPendingFichas,
} from "@/lib/emergency-offline";
import { StormVictimItem } from "@/types/emergency";

const AUTO_SYNC_MS = 60 * 1000;

/**
 * Fichas guardadas en este dispositivo que todavía no llegaron al sistema.
 * Se envían solas al abrir la pantalla, cuando vuelve la conexión y cada minuto.
 */
export function useOfflineFichas(userId: string, onSynced: () => void) {
  const [pending, setPending] = useState<PendingFicha[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => setPending(readPendingFichas(userId)), [userId]);

  const sync = useCallback(
    async (manual = false) => {
      if (readPendingFichas(userId).length === 0) return;
      if (navigator.onLine === false) {
        if (manual) toast.error("Todavía no hay conexión. Las fichas siguen guardadas en este dispositivo.");
        return;
      }
      setSyncing(true);
      try {
        const result = await syncPendingFichas(userId);
        if (result.sent > 0) {
          toast.success(
            result.sent === 1 ? "Se envió 1 ficha que estaba guardada sin conexión." : `Se enviaron ${result.sent} fichas que estaban guardadas sin conexión.`
          );
          onSynced();
        }
        if (result.sessionExpired) {
          toast.error("Tu sesión venció. Volvé a iniciar sesión para enviar las fichas guardadas.");
        } else if (manual && result.sent === 0 && result.remaining > 0) {
          toast.error("No se pudieron enviar las fichas. Revisá el motivo en cada una.");
        }
      } finally {
        setSyncing(false);
        reload();
      }
    },
    [userId, onSynced, reload]
  );

  useEffect(() => {
    reload();
    setOnline(navigator.onLine !== false);
    sync();

    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("muni-fichas-pendientes")) reload();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(PENDING_FICHAS_EVENT, reload);
    window.addEventListener("storage", onStorage);
    const timer = setInterval(() => sync(), AUTO_SYNC_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(PENDING_FICHAS_EVENT, reload);
      window.removeEventListener("storage", onStorage);
      clearInterval(timer);
    };
  }, [reload, sync]);

  return { pending, online, syncing, sync, reload };
}

interface OfflineFichasPanelProps {
  userId: string;
  pending: PendingFicha[];
  online: boolean;
  syncing: boolean;
  onSyncNow: () => void;
  onEdit: (record: StormVictimItem) => void;
}

/** Aviso de "sin conexión" y lista de fichas que esperan para enviarse. */
export function OfflineFichasPanel({ userId, pending, online, syncing, onSyncNow, onEdit }: OfflineFichasPanelProps) {
  if (online && pending.length === 0) return null;

  const discard = (item: PendingFicha) => {
    const name = item.payload.nombreApellido || "esta ficha";
    if (!confirm(`¿Descartar la ficha de ${name}? Todavía no se envió, así que se pierde.`)) return;
    removePendingFicha(userId, item.clientId);
  };

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 text-sm" role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {online ? <CloudOff className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /> : <WifiOff className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold text-foreground">
              {online ? "Hay fichas sin enviar" : "Sin conexión"}
            </p>
            <p className="text-xs text-muted-foreground">
              {online
                ? "Quedaron guardadas en este dispositivo. Se envían solas; también podés enviarlas ahora."
                : "Podés seguir cargando fichas: quedan guardadas en este dispositivo y se envían solas cuando vuelva internet."}
            </p>
          </div>
        </div>
        {pending.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSyncNow}
            disabled={!online || syncing}
            className="rounded-xl text-xs font-bold h-9"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Enviando..." : "Enviar ahora"}
          </Button>
        )}
      </div>

      {pending.length > 0 && (
        <ul className="divide-y divide-amber-500/20 rounded-xl border border-amber-500/30 bg-background/70">
          {pending.map((item) => (
            <li key={item.clientId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-foreground truncate">{item.payload.nombreApellido || "Sin nombre"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.payload.domicilio || "Sin domicilio"} · guardada el{" "}
                  {new Date(item.savedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
                {item.lastError && <p className="text-[11px] font-semibold text-rose-600">No se envió: {item.lastError}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => onEdit({ ...(item.payload as StormVictimItem), clientId: item.clientId })}
                >
                  <FileText className="mr-1 h-3.5 w-3.5" /> Revisar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-600"
                  title="Descartar ficha"
                  onClick={() => discard(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
