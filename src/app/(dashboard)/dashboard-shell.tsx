"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EmergencyHeaderWidget } from "@/components/emergency/emergency-header-widget";
import { UserNav } from "@/components/layout/user-nav";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { PrintHeader, PrintFooter } from "@/components/ui/print-layout";
import { DashboardBreadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { OfflineSupport, SituationRoomButton } from "@/components/layout/header-extras";
import { InactivityLogout } from "@/components/layout/inactivity-logout";
import { MunicipalSettingsProvider } from "@/components/providers/municipal-settings";
import type { PublicMunicipalSettings } from "@/types/settings";

export function DashboardShell({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: PublicMunicipalSettings;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <Providers>
      <MunicipalSettingsProvider settings={settings}>
        <OfflineSupport />
        <InactivityLogout />
        <div className="flex min-h-screen bg-background relative transition-colors duration-300 print:bg-white print:text-black">
          {/* Sidebar escritorio */}
          <aside className="hidden md:block sticky top-0 h-screen shrink-0 self-start print:hidden z-30">
            <AppSidebar />
          </aside>

          <main className="flex-1 min-w-0 print:p-0 flex flex-col min-h-screen">
            {/* Franja superior institucional Tres de Febrero */}
            <div className="h-1 w-full bg-gradient-to-r from-[#163C68] via-[#163C68] to-[#F69321] shrink-0 print:hidden" />

            <header className="h-16 sticky top-0 z-40 border-b border-border/60 bg-card/85 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shadow-xs text-foreground print:hidden">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Botón menú responsive mobile */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-9 w-9 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Abrir menú de navegación"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-80 max-w-[85vw] border-r border-border/60 bg-card">
                    <AppSidebar isMobile onNavigate={() => setMobileOpen(false)} />
                  </SheetContent>
                </Sheet>

                <MunicipalCrest className="h-8 w-8 md:hidden" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate font-heading">
                    Desarrollo Humano y Hábitat
                  </p>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">
                    Municipalidad de Tres de Febrero
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <SituationRoomButton />

                <EmergencyHeaderWidget />
                <NotificationBell />
                <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
                <UserNav variant="header" />
              </div>
            </header>

            <div className="p-4 sm:p-8 bg-background/40 print:bg-white print:p-0 flex-1">
              <PrintHeader />
              <DashboardBreadcrumbs />
              {children}
              <PrintFooter />
            </div>

            <footer className="mt-auto border-t border-border/50 px-6 py-3 print:hidden">
              <p className="text-center text-xs text-muted-foreground">
                Municipalidad de Tres de Febrero · Secretaría de Desarrollo Humano y Hábitat
              </p>
            </footer>
          </main>
        </div>
      </MunicipalSettingsProvider>
    </Providers>
  );
}
