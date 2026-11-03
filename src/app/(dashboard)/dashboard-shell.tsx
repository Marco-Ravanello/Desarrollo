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
import { NovedadesAviso } from "@/components/layout/novedades-aviso";
import { BienvenidaAviso } from "@/components/layout/bienvenida-aviso";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { HelpPanel } from "@/components/layout/help-panel";
import { MunicipalSettingsProvider } from "@/components/providers/municipal-settings";
import type { PublicMunicipalSettings } from "@/types/settings";
import type { Session } from "next-auth";

export function DashboardShell({
  children,
  settings,
  session,
  showWelcome = false,
}: {
  children: React.ReactNode;
  settings: PublicMunicipalSettings;
  session?: Session | null;
  /** La persona todavía no vio la bienvenida de la primera vez. */
  showWelcome?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // Primero la bienvenida; las novedades esperan a que se cierre.
  const [welcomePending, setWelcomePending] = React.useState(showWelcome);

  return (
    <Providers session={session}>
      <MunicipalSettingsProvider settings={settings}>
        <OfflineSupport />
        <InactivityLogout />
        <BienvenidaAviso firstTime={showWelcome} onDone={() => setWelcomePending(false)} />
        <NovedadesAviso hold={welcomePending} />
        <KeyboardShortcuts />
        <div className="flex min-h-screen bg-background relative transition-colors duration-300 print:bg-white print:text-black">
          {/* Sidebar escritorio */}
          <aside className="hidden md:block sticky top-0 h-screen shrink-0 self-start print:hidden z-30">
            <AppSidebar />
          </aside>

          <main className="flex-1 min-w-0 print:p-0 flex flex-col min-h-screen">
            {/* Encabezado institucional: azul de Tres de Febrero con la línea naranja abajo. */}
            <header className="h-16 sticky top-0 z-40 border-b-[3px] border-muni-orange bg-gradient-to-r from-[#0E2A49] via-[#163C68] to-[#22507F] dark:from-[#0A1F37] dark:via-[#10304F] dark:to-[#163C68] flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-md text-white print:hidden">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Botón menú responsive mobile */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-9 w-9 rounded-xl border border-white/25 text-white/90 hover:bg-white/10 hover:text-white shrink-0"
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
                  {/* En el celular no entra el nombre largo: va el de la app. */}
                  <p className="text-sm font-bold text-white truncate font-heading tracking-tight sm:hidden">
                    MuniGestión <span className="text-muni-orange">3F</span>
                  </p>
                  <p className="text-sm font-bold text-white truncate font-heading tracking-tight hidden sm:block">
                    Desarrollo Humano y Hábitat <span className="text-muni-orange">3F</span>
                  </p>
                  <p className="text-xs text-white/75 truncate hidden sm:block">
                    Municipalidad de Tres de Febrero
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <SituationRoomButton />

                <EmergencyHeaderWidget />
                <HelpPanel />
                <NotificationBell />
                <div className="h-6 w-px bg-white/20 mx-1 hidden sm:block" />
                <UserNav variant="header" />
              </div>
            </header>

            {/* Mismo ancho y márgenes en todas las páginas: las páginas no ponen su propio ancho máximo. */}
            <div className="flex-1 bg-background/40 px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 print:bg-white print:p-0">
              <div className="mx-auto w-full max-w-screen-2xl">
                <PrintHeader />
                <DashboardBreadcrumbs />
                {children}
                <PrintFooter />
              </div>
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
