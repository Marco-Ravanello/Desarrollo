"use client";

import * as React from "react";
import { LayoutDashboard, Users, ShieldAlert, ClipboardList, LogOut, Briefcase, Car, UserCog, ChevronLeft, ChevronRight, CheckCircle2, MapPin, Wallet, Building2, FileSpreadsheet, Calendar, Sparkles, CloudRain, Settings } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { getAreaNavColor, getAreaBgColor } from "@/lib/area-theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "./theme-toggle";

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user;

  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  const navigation = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-blue-500" },
    { title: "Mapa Social", url: "/maps", icon: MapPin, color: "text-emerald-500" },
    { title: "Mis Tareas", url: "/tasks", icon: CheckCircle2, color: "text-amber-500" },
    { title: "Registro Único", url: "/people", icon: Users, color: "text-purple-500" },
  ];

  const adminNav = [
    { title: "Agenda Unificada", url: "/admin/calendar", icon: Calendar, color: "text-slate-400" },
    { title: "Asistente de IA", url: "/admin/assistant", icon: Sparkles, color: "text-blue-500 animate-pulse" },
    { title: "Órdenes de compras", url: "/admin/purchase-orders", icon: Briefcase, color: "text-slate-400" },
    { title: "Vehículos y Logística", url: "/admin/vehicles", icon: Car, color: "text-slate-400" },
    { title: "Stock de Insumos", url: "/admin/stock", icon: ClipboardList, color: "text-slate-400" },
    { title: "Convenios y Presupuesto", url: "/admin/budget", icon: Wallet, color: "text-slate-400" },
    { title: "Recursos Humanos", url: "/admin/hr", icon: UserCog, color: "text-slate-400" },
    { title: "Emergencia Climática", url: "/admin/emergency", icon: CloudRain, color: "text-amber-500 font-bold" },
    { title: "Configuración", url: "/admin/settings", icon: Settings, color: "text-slate-400" },
    ...(user?.role === 'SUPERADMIN' ? [
      { title: "Importar Datos", url: "/admin/interventions", icon: FileSpreadsheet, color: "text-slate-400" },
      { title: "Usuarios", url: "/admin/users", icon: UserCog, color: "text-slate-400" },
      { title: "Auditoría", url: "/admin/audit", icon: ClipboardList, color: "text-slate-400" }
    ] : []),
  ];

  const socialAreas = [
    { title: "Protección Social", url: "/areas/social", icon: ClipboardList, color: "emerald" },
    { title: "Niñez y Familia", url: "/areas/ninez", icon: ClipboardList, color: "amber" },
    { title: "Hábitat y Vivienda", url: "/areas/habitat", icon: Building2, color: "blue" },
  ];

  const sidebarColor = getAreaBgColor(user?.role === 'SUPERADMIN' ? 'slate' : (user as any)?.area?.color);

  return (
    <div className={`${isCollapsed ? "w-20" : "w-72"} h-screen sticky top-0 bg-card text-card-foreground flex flex-col shrink-0 overflow-hidden transition-all duration-300 relative border-r border-border/60 shadow-sm z-30`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={`absolute -right-3 top-20 h-6 w-6 rounded-full ${sidebarColor} hover:brightness-110 text-white border-none shadow-md z-50 print:hidden`}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className={`p-5 space-y-4 ${isCollapsed ? "px-3" : ""}`}>
        <div className={`text-2xl font-bold flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
          <div className={`bg-primary p-2 rounded-2xl text-white shadow-lg shadow-primary/20 shrink-0`}>
            <Building2 className="h-6 w-6" />
          </div>
          {!isCollapsed && <span className="tracking-tight truncate font-black text-primary text-xl">MuniGestión</span>}
        </div>

        {!isCollapsed && <GlobalSearch />}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="pb-2">
          {!isCollapsed && <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Principal</p>}
          {navigation.map((item) => {
            const isActive = pathname === item.url;
            return (
              <Link
                key={item.title}
                href={item.url}
                title={isCollapsed ? item.title : ""}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group mb-1 ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary-foreground" : item.color} group-hover:text-primary transition-colors`} />
                {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
              </Link>
            );
          })}
        </div>

        <div className="pt-3 pb-2">
          {!isCollapsed && <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Administración</p>}
          {adminNav.map((item) => {
            const isActive = pathname.startsWith(item.url);
            return (
              <Link
                key={item.title}
                href={item.url}
                title={isCollapsed ? item.title : ""}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group mb-1 ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  isActive ? "bg-primary/10 text-primary font-bold dark:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"} group-hover:text-primary transition-colors`} />
                {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
              </Link>
            );
          })}
        </div>

        <div className="pt-3 pb-2">
          {!isCollapsed && <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Áreas Sociales</p>}
          {socialAreas.map((item) => (
            <Link
              key={item.title}
              href={item.url}
              title={isCollapsed ? item.title : ""}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all group mb-1 font-medium ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${getAreaNavColor(item.color)} opacity-70 group-hover:opacity-100 transition-opacity`} />
              {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-3 border-t border-border/60 bg-muted/20">
        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 rounded-xl border border-border shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {user?.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">{user?.name || "Usuario"}</p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase truncate">{user?.role || "Agente"}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
