"use client";

import * as React from "react";
import { LayoutDashboard, Users, ShieldAlert, ClipboardList, LogOut, Briefcase, Car, UserCog, ChevronLeft, ChevronRight, CheckCircle2, MapPin, Wallet, Building2, FileSpreadsheet, Calendar, Sparkles, CloudRain, Settings, Tv, Network, BarChart3, ChevronDown, Package, ScrollText } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { UserNav } from "./user-nav";
import { useSession, signOut } from "next-auth/react";
import { getAreaNavColor, getAreaBgColor } from "@/lib/area-theme";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "./theme-toggle";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

interface AppSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ isMobile = false, onNavigate }: AppSidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user;

  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (isMobile) {
      setIsCollapsed(false);
      return;
    }
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, [isMobile]);

  const toggleSidebar = () => {
    if (isMobile) return;
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  const navigation = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-blue-500" },
    { title: "Ficha Social 360°", url: "/ficha-social", icon: Network, color: "text-indigo-500 font-bold" },
    { title: "Expedientes", url: "/cases", icon: ClipboardList, color: "text-rose-500 font-bold" },
    { title: "Mapa Social", url: "/maps", icon: MapPin, color: "text-emerald-500" },
    { title: "Mis Tareas", url: "/tasks", icon: CheckCircle2, color: "text-amber-500" },
    { title: "Registro Único", url: "/people", icon: Users, color: "text-purple-500" },
  ];

  const role = user?.role as any;
  const canManageUsers = Boolean(
    role && (role === "SUPERADMIN" || role === "DIRECCION_GENERAL" || role === "ADMIN_GENERAL" || hasPermission(role, PERMISSIONS.MANAGE_USERS))
  );

  // Administración agrupada por tema; cada grupo se puede plegar.
  const adminGroups: { id: string; title: string; items: { title: string; url: string; icon: any }[] }[] = [
    {
      id: "operacion",
      title: "Operación diaria",
      items: [
        { title: "Sala de Situación", url: "/admin/war-room", icon: Tv },
        { title: "Agenda Unificada", url: "/admin/calendar", icon: Calendar },
        { title: "Asistente de IA", url: "/admin/assistant", icon: Sparkles },
        { title: "Emergencia Climática", url: "/admin/emergency", icon: CloudRain },
      ],
    },
    {
      id: "compras",
      title: "Compras y presupuesto",
      items: [
        { title: "Órdenes de compras", url: "/admin/purchase-orders", icon: Briefcase },
        { title: "Proveedores", url: "/admin/providers", icon: Building2 },
        { title: "Convenios y Presupuesto", url: "/admin/budget", icon: Wallet },
        ...(role && hasPermission(role, PERMISSIONS.VIEW_REPORTS)
          ? [{ title: "Reportes", url: "/admin/reports", icon: BarChart3 }]
          : []),
      ],
    },
    {
      id: "recursos",
      title: "Recursos",
      items: [
        { title: "Vehículos y Logística", url: "/admin/vehicles", icon: Car },
        { title: "Stock de Insumos", url: "/admin/stock", icon: Package },
        { title: "Recursos Humanos", url: "/admin/hr", icon: UserCog },
      ],
    },
    {
      id: "sistema",
      title: "Sistema",
      items: [
        { title: "Configuración", url: "/admin/settings", icon: Settings },
        ...(canManageUsers
          ? [
              { title: "Importar Datos", url: "/admin/interventions", icon: FileSpreadsheet },
              { title: "Usuarios", url: "/admin/users", icon: Users },
            ]
          : []),
        ...(role && hasPermission(role, PERMISSIONS.VIEW_AUDIT_LOGS)
          ? [{ title: "Auditoría", url: "/admin/audit", icon: ScrollText }]
          : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  const activeGroup = adminGroups.find((g) => g.items.some((i) => pathname.startsWith(i.url)))?.id;
  const [closedGroups, setClosedGroups] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-closed-groups");
      if (saved) setClosedGroups(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleGroup = (id: string) => {
    setClosedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      try { localStorage.setItem("sidebar-closed-groups", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const socialAreas = [
    { title: "Protección Social", url: "/areas/social", icon: ClipboardList, color: "emerald" },
    { title: "Niñez y Familia", url: "/areas/ninez", icon: ClipboardList, color: "amber" },
    { title: "Hábitat y Vivienda", url: "/areas/habitat", icon: Building2, color: "blue" },
    ...(user?.role && hasPermission(user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES) ? [
      { title: "Violencia y Género", url: "/areas/violence", icon: ShieldAlert, color: "rose" }
    ] : [])
  ];

  const sidebarColor = getAreaBgColor(user?.role === 'SUPERADMIN' ? 'slate' : (user as any)?.area?.color);

  return (
    <div className={`${isCollapsed ? "w-20" : "w-72"} h-screen max-h-screen bg-card text-card-foreground flex flex-col shrink-0 overflow-hidden transition-all duration-300 relative border-r border-border/60 shadow-sm`}>
      {!isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`absolute -right-3 top-20 h-6 w-6 rounded-full ${sidebarColor} hover:brightness-110 text-white border-none shadow-md z-50 print:hidden`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}

      <div className={`p-5 space-y-4 shrink-0 ${isCollapsed ? "px-3" : ""}`}>
        <div className={`text-2xl font-bold flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="h-11 w-11 rounded-2xl overflow-hidden shrink-0 border border-primary/20 bg-white p-1 shadow-sm flex items-center justify-center">
            <MunicipalCrest className="h-full w-full" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground truncate">
                TRES DE FEBRERO
              </span>
              <span className="tracking-tight truncate font-black text-[#163C68] dark:text-blue-400 text-lg font-heading">
                MuniGestión <span className="text-[#F69321]">3F</span>
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && <GlobalSearch />}
      </div>

      <nav className="flex-1 min-h-0 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="pb-2">
          {!isCollapsed && <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 font-heading">Principal</p>}
          {navigation.map((item) => {
            const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
            return (
              <Link
                key={item.title}
                href={item.url}
                onClick={() => onNavigate?.()}
                title={isCollapsed ? item.title : ""}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group mb-1 ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  isActive ? "bg-[#163C68] text-white shadow-sm font-bold border-l-4 border-[#F69321]" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : item.color} group-hover:text-primary transition-colors`} />
                {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
              </Link>
            );
          })}
        </div>

        {adminGroups.map((group) => {
          // El grupo de la pantalla actual siempre queda abierto.
          const isOpen = isCollapsed || group.id === activeGroup || !closedGroups.includes(group.id);
          return (
            <div key={group.id} className={isCollapsed ? "pt-2 mt-2 border-t border-border/40" : "pt-2"}>
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg text-[11px] font-bold text-muted-foreground uppercase tracking-wider font-heading hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  {group.title}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
              )}
              {isOpen && group.items.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <Link
                    key={item.title}
                    href={item.url}
                    onClick={() => onNavigate?.()}
                    title={isCollapsed ? item.title : ""}
                    className={`flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all group mb-0.5 ${
                      isCollapsed ? "justify-center" : ""
                    } ${
                      isActive ? "bg-primary/10 text-primary font-bold dark:bg-primary/20 border-l-4 border-[#F69321]" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                    }`}
                  >
                    <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"} group-hover:text-primary transition-colors`} />
                    {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="pt-3 pb-2">
          {!isCollapsed && <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Áreas Sociales</p>}
          {socialAreas.map((item) => (
            <Link
              key={item.title}
              href={item.url}
              onClick={() => onNavigate?.()}
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

      <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0">
        <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="min-w-0 flex-1">
            <UserNav variant="sidebar" isCollapsed={isCollapsed} />
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-0.5 shrink-0">
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
