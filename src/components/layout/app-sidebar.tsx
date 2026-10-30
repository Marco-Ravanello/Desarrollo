"use client";

import * as React from "react";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { UserNav } from "./user-nav";
import { useSession, signOut } from "next-auth/react";
import { getAreaBgColor } from "@/lib/area-theme";
import { NAV_GROUPS, SECTION_TONE_CLASSES, isNavItemActive } from "@/lib/secciones";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "./theme-toggle";
import { canAccessPath, isEmergencySurveyor } from "@/lib/permissions";
import { clearOfflineCache } from "@/lib/emergency-offline";

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

  const role = user?.role;
  const canOpen = (url: string) => canAccessPath(role, url);

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => canOpen(i.url)) }))
    .filter((g) => g.items.length > 0);

  const activeGroup = groups.find((g) => g.items.some((i) => isNavItemActive(pathname, i.url)))?.id;
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

  const sidebarColor = getAreaBgColor(user?.role === 'SUPERADMIN' ? 'slate' : (user as any)?.area?.color);

  return (
    <div className={`${isCollapsed ? "w-20" : "w-72"} h-screen max-h-screen bg-card text-card-foreground flex flex-col shrink-0 overflow-hidden transition-all duration-300 relative border-r border-border/60 shadow-sm`}>
      {!isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Abrir menú" : "Achicar menú"}
          className={`absolute -right-3 top-20 h-6 w-6 rounded-full ${sidebarColor} hover:brightness-110 text-white border-none shadow-md z-50 print:hidden`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}

      <div className={`p-5 space-y-4 shrink-0 ${isCollapsed ? "px-3" : ""}`}>
        <div className={`text-2xl font-bold flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
          <MunicipalCrest className="h-11 w-11 shadow-sm" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-semibold text-muted-foreground truncate">
                Tres de Febrero
              </span>
              <span className="tracking-tight truncate font-bold text-[#163C68] dark:text-blue-300 text-lg font-heading">
                MuniGestión <span className="text-[#C2410C] dark:text-[#F69321]">3F</span>
              </span>
            </div>
          )}
        </div>
        {!isCollapsed && !isEmergencySurveyor(role) && <GlobalSearch />}
      </div>

      <nav className="flex-1 min-h-0 px-3 pb-3 overflow-y-auto custom-scrollbar">
        {groups.map((group, index) => {
          // El grupo de la pantalla actual siempre queda abierto.
          const isOpen = !group.collapsible || isCollapsed || group.id === activeGroup || !closedGroups.includes(group.id);
          const groupTone = SECTION_TONE_CLASSES[group.tone];
          return (
            <div
              key={group.id}
              className={isCollapsed ? (index > 0 ? "pt-2 mt-2 border-t border-border/40" : "") : index > 0 ? "pt-3" : ""}
            >
              {!isCollapsed && (
                group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg text-xs font-bold text-muted-foreground font-heading hover:text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${groupTone.dot}`} />
                    <span className="flex-1 text-left">{group.title}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                ) : (
                  <p className="flex items-center gap-2 px-3 py-1.5 mb-1 text-xs font-bold text-muted-foreground font-heading">
                    {group.id !== "areas" && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${groupTone.dot}`} />}
                    {group.title}
                  </p>
                )
              )}
              {isOpen && group.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.url);
                const tone = SECTION_TONE_CLASSES[item.tone ?? group.tone];
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={() => onNavigate?.()}
                    title={isCollapsed ? item.title : ""}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors group mb-0.5 ${
                      isCollapsed ? "justify-center" : ""
                    } ${
                      isActive ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isActive ? `${tone.chipActive} shadow-sm` : tone.chip
                      }`}
                    >
                      <item.icon className="h-[17px] w-[17px]" />
                    </span>
                    {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
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
                onClick={() => clearOfflineCache().finally(() => signOut({ callbackUrl: "/login" }))}
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
