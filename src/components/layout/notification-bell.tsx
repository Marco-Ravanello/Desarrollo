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
    // Polling cada 30 segundos
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
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-900">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-rose-500 border-2 border-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="font-bold text-sm">Notificaciones</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-[10px] h-auto p-1" onClick={handleMarkAllRead}>
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              No tienes notificaciones.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-default focus:bg-slate-50 ${!n.read ? "bg-blue-50/50" : ""}`}
              >
                <div className="flex justify-between w-full gap-2">
                  <div className="flex items-center gap-2">
                    <Info className={`h-4 w-4 ${!n.read ? "text-blue-500" : "text-slate-400"}`} />
                    <span className={`font-bold text-sm ${!n.read ? "text-slate-900" : "text-slate-600"}`}>{n.title}</span>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-slate-400 hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-normal">{n.message}</p>
                {n.link && (
                  <Link
                    href={n.link}
                    className="text-[10px] text-blue-600 font-bold hover:underline mt-1"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Ver detalles
                  </Link>
                )}
                <span className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs text-slate-500 h-8" disabled>
            Ver todas las notificaciones
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
