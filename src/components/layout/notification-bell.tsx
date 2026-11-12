"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Info } from "lucide-react";
import { getBellState, markAsRead, markAllAsRead, undoMarkAllAsRead } from "@/app/(dashboard)/actions/notifications";
import { toastWithUndo } from "@/components/ui/undo-toast";
import { BELL_POLL_MS, BELL_REFRESH_ON_VISIBLE_MS, shouldPollBell } from "@/lib/bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatFechaHora } from "@/lib/fechas";
import { tituloConAvisos } from "@/lib/titulo-avisos";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const lastFetchAt = useRef(0);
  const inFlight = useRef(false);

  // Un solo pedido trae los últimos 10 avisos y cuántos hay sin leer en total.
  const fetchNotifications = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastFetchAt.current = Date.now();
    try {
      const { items, unread } = await getBellState();
      setNotifications(items);
      const listed = items.filter((n: any) => !n.read).length;
      setUnreadCount(Math.max(listed, unread));
    } catch {
      // Sin conexión o la sesión venció: se vuelve a intentar en la próxima vuelta.
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Pregunta cada un minuto solo mientras la pestaña está a la vista (idea 130). Escondida, no pregunta;
  // al volver a ella, pregunta enseguida si pasó un rato.
  useEffect(() => {
    fetchNotifications();
    const visible = () => document.visibilityState === "visible";
    const tick = () => {
      if (shouldPollBell({ visible: visible(), lastFetchAt: lastFetchAt.current, now: Date.now(), minGapMs: BELL_POLL_MS - 1000 })) {
        fetchNotifications();
      }
    };
    const onVisible = () => {
      if (shouldPollBell({ visible: visible(), lastFetchAt: lastFetchAt.current, now: Date.now(), minGapMs: BELL_REFRESH_ON_VISIBLE_MS })) {
        fetchNotifications();
      }
    };
    const interval = setInterval(tick, BELL_POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNotifications]);

  // Los avisos sin leer también se ven en la pestaña del navegador: "(3) Inicio · MuniGestión 3F".
  // Al cambiar de pantalla la app pone otro título, así que se vuelve a agregar cada vez que cambia.
  useEffect(() => {
    const apply = () => {
      const next = tituloConAvisos(document.title, unreadCount);
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = tituloConAvisos(document.title, 0);
    };
  }, [unreadCount]);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    const ids = await markAllAsRead();
    fetchNotifications();
    if (ids.length > 0) {
      const texto = ids.length === 1 ? "Marcaste 1 aviso como leído." : `Marcaste ${ids.length.toLocaleString("es-AR")} avisos como leídos.`;
      toastWithUndo(texto, () => undoMarkAllAsRead(ids), () => fetchNotifications());
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Al abrirla, lo más nuevo (si la última pregunta fue hace más de unos segundos).
        if (open && Date.now() - lastFetchAt.current > BELL_REFRESH_ON_VISIBLE_MS) fetchNotifications();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Avisos (${unreadCount} sin leer)` : "Avisos"}
          className="relative text-white hover:bg-white/10 hover:text-white"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center px-1 py-0 bg-muni-orange hover:bg-muni-orange border-2 border-[#163C68] text-muni-navy font-bold text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card border-border/60 text-card-foreground shadow-xl rounded-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <span className="font-bold text-xs text-foreground">Notificaciones</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-auto p-1 font-bold text-primary hover:text-primary/80" onClick={handleMarkAllRead}>
              Marcar todas leídas
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-xs italic font-medium">
              No tenés avisos pendientes.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-default focus:bg-muted/40 ${!n.read ? "bg-muni-orange/[0.07] shadow-[inset_3px_0_0_#F69321]" : ""}`}
              >
                <div className="flex justify-between w-full gap-2">
                  <div className="flex items-center gap-2">
                    <Info className={`h-4 w-4 shrink-0 ${!n.read ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-bold text-xs ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</span>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-primary shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-normal font-medium">{n.message}</p>
                {n.link && (
                  <Link
                    href={n.link}
                    className="text-xs text-primary font-bold hover:underline mt-1"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Ver detalles
                  </Link>
                )}
                <span className="text-xs text-muted-foreground mt-1">{formatFechaHora(n.createdAt)}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="bg-border/40" />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" disabled>
            Historial de notificaciones
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
