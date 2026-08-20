"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, MapPin, CheckCircle2, ShieldAlert,
  Briefcase, Car, Wallet, Building2, UserCog, History, DollarSign,
  Sparkles, FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = user?.role === "SUPERADMIN" || user?.role === "ADMIN_GENERAL" || user?.role === "DIRECCION_GENERAL";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Mapa Social GIS", href: "/maps", icon: MapPin },
    { name: "Registro Único", href: "/people", icon: Users },
    { name: "Mis Tareas", href: "/tasks", icon: CheckCircle2 },
    { name: "Asistente IA", href: "/admin/assistant", icon: Sparkles, badge: "IA" },
  ];

  const adminNav = [
    { name: "Órdenes de Compra", href: "/admin/purchase-orders", icon: Briefcase },
    { name: "Flota Logística", href: "/admin/vehicles", icon: Car },
    { name: "Convenios", href: "/admin/agreements", icon: Wallet },
    { name: "Recursos Humanos", href: "/admin/hr", icon: Building2 },
  ];

  const systemNav = isAdmin ? [
    { name: "Usuarios y Roles", href: "/admin/users", icon: UserCog },
    { name: "Auditoría", href: "/admin/audit", icon: History },
    { name: "Presupuesto", href: "/admin/budget", icon: DollarSign },
  ] : [];

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-card/60 backdrop-blur-2xl flex flex-col justify-between h-screen sticky top-0 z-40 transition-all duration-300">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm text-foreground tracking-tight">MuniGestión</span>
            <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">Desarrollo & Hábitat</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">Navegación</p>
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group relative ${
                    isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <Badge className="bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[9px] px-1.5 py-0.2 font-bold uppercase">
                      {item.badge}
                    </Badge>
                  )}
                  {isActive && (
                    <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 pt-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">Gestión</p>
            {adminNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group ${
                    isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {systemNav.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">Sistema</p>
              {systemNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 group ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-white/[0.08] bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs ring-2 ring-background">
                {user?.name?.[0] || "U"}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-foreground truncate max-w-[120px]">{user?.name || "Usuario"}</span>
              <span className="text-[9px] text-muted-foreground font-mono uppercase">{user?.role || "OPERADOR"}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
