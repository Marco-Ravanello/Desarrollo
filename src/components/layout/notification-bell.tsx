"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Info } from "lucide-react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from "@/app/(dashboard)/actions/notifications";
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
    setUnreadCount(data.filter((n: any) => !n.read).length);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchNotifications();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted/50">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-rose-500 border-2 border-background text-white font-bold text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card border-border/60 text-card-foreground shadow-xl rounded-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <span className="font-bold text-xs uppercase tracking-wider text-foreground">Notificaciones</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-[10px] h-auto p-1 font-bold text-primary hover:text-primary/80" onClick={handleMarkAllRead}>
              Marcar todas leídas
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-xs italic font-medium">
              No tienes notificaciones pendientes.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-default focus:bg-muted/40 ${!n.read ? "bg-primary/5" : ""}`}
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
                    className="text-[10px] text-primary font-bold hover:underline mt-1"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Ver detalles
                  </Link>
                )}
                <span className="text-[9px] text-muted-foreground/60 mt-1">{new Date(n.createdAt).toLocaleString()}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="bg-border/40" />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" disabled>
            Historial de Notificaciones
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
