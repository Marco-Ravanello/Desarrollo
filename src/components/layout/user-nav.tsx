"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCog, UserPlus, Settings, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

interface UserNavProps {
  variant?: "header" | "sidebar";
  isCollapsed?: boolean;
}

export function UserNav({ variant = "header", isCollapsed = false }: UserNavProps) {
  const { data: session } = useSession();
  const user = session?.user;

  if (!user) return null;

  const userRole = user.role as any;
  const canManageUsers =
    userRole === "SUPERADMIN" ||
    userRole === "DIRECCION_GENERAL" ||
    userRole === "ADMIN_GENERAL" ||
    hasPermission(userRole, PERMISSIONS.MANAGE_USERS);

  const initial = user.name?.[0]?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button
            type="button"
            className="w-full flex items-center gap-2.5 p-1 rounded-2xl hover:bg-muted/60 transition-colors text-left focus:outline-none group"
            title="Opciones de cuenta y perfil"
          >
            <Avatar className="h-9 w-9 rounded-xl border border-primary/20 shrink-0 shadow-xs">
              <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                {initial}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 flex items-center justify-between">
                <div className="min-w-0 truncate">
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {user.name || "Usuario"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase truncate">
                    {user.role || "Agente"}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1 group-hover:text-foreground transition-colors" />
              </div>
            )}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 px-2.5 rounded-xl text-xs font-bold text-foreground hover:bg-muted/60"
          >
            <Avatar className="h-7 w-7 rounded-lg border border-primary/20 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-black text-[11px]">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden lg:inline-block max-w-[120px] truncate">{user.name || "Agente"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:block" />
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={variant === "sidebar" ? "start" : "end"}
        side={variant === "sidebar" ? "top" : "bottom"}
        className="w-64 bg-card border border-border/80 shadow-2xl rounded-2xl p-1.5 z-50 text-foreground"
      >
        <DropdownMenuLabel className="p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Agente Municipal
            </span>
            <Badge className="bg-primary/15 text-primary border border-primary/20 text-[9px] font-bold uppercase py-0">
              {user.role || "OPERATIVO"}
            </Badge>
          </div>
          <p className="text-xs font-black text-foreground truncate">{user.name || "Usuario Municipal"}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{user.email || ""}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-border/60" />

        {canManageUsers && (
          <>
            <DropdownMenuItem asChild className="rounded-xl text-xs font-semibold cursor-pointer py-2 focus:bg-primary/10 focus:text-primary">
              <Link href="/admin/users" className="flex items-center gap-2.5 w-full">
                <UserCog className="h-4 w-4 text-primary" />
                <span>Gestión de Usuarios</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl text-xs font-semibold cursor-pointer py-2 focus:bg-primary/10 focus:text-primary">
              <Link href="/admin/users?new=true" className="flex items-center gap-2.5 w-full font-bold text-primary">
                <UserPlus className="h-4 w-4 text-primary" />
                <span>+ Crear Nuevo Usuario</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
          </>
        )}

        {(userRole === "SUPERADMIN" || userRole === "ADMIN_GENERAL" || userRole === "DIRECCION_GENERAL") && (
          <DropdownMenuItem asChild className="rounded-xl text-xs font-semibold cursor-pointer py-2 focus:bg-primary/10 focus:text-primary">
            <Link href="/admin/settings" className="flex items-center gap-2.5 w-full">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Configuración del Sistema</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1 bg-border/60" />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-xl text-xs font-semibold cursor-pointer py-2 text-rose-500 hover:text-rose-600 focus:bg-rose-500/10 focus:text-rose-600"
        >
          <LogOut className="h-4 w-4 mr-2.5" />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
