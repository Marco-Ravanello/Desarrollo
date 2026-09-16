import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EmergencyHeaderWidget } from "@/components/emergency/emergency-header-widget";
import { UserNav } from "@/components/layout/user-nav";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { PrintHeader, PrintFooter } from "@/components/ui/print-layout";
import { DashboardBreadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Tv } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-background relative transition-colors duration-300 print:bg-white print:text-black">
        <aside className="sticky top-0 h-screen shrink-0 self-start print:hidden z-30">
          <AppSidebar />
        </aside>
        <main className="flex-1 min-w-0 print:p-0 flex flex-col min-h-screen">
          {/* Franja superior institucional Tres de Febrero */}
          <div className="h-1 w-full bg-gradient-to-r from-[#163C68] via-[#163C68] to-[#F69321] shrink-0 print:hidden" />

          <header className="h-16 sticky top-0 z-40 border-b border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sm:px-8 shadow-xs text-foreground print:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 bg-primary/10 rounded-xl border border-primary/20 shrink-0 hidden sm:flex">
                <MunicipalCrest className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider truncate font-heading">
                  Secretaría de Desarrollo Humano y Hábitat
                </h1>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest truncate hidden md:block">
                  Municipalidad de Tres de Febrero • Sistema Integrado de Gestión Pública
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl h-9 px-3 text-xs font-bold border-border/60 hover:bg-primary/10 hover:text-primary transition-colors hidden md:flex items-center gap-1.5"
                title="Abrir Sala de Situación Ejecutiva (Modo Proyector)"
              >
                <Link href="/admin/war-room">
                  <Tv className="h-3.5 w-3.5 text-blue-500" />
                  <span>Sala de Situación</span>
                </Link>
              </Button>

              <EmergencyHeaderWidget />
              <NotificationBell />
              <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
              <UserNav variant="header" />
            </div>
          </header>

          <div className="p-6 sm:p-8 bg-background/40 print:bg-white print:p-0 flex-1">
            <PrintHeader />
            <DashboardBreadcrumbs />
            {children}
            <PrintFooter />
          </div>

          {/* Pie de página institucional Tres de Febrero */}
          <footer className="mt-auto border-t border-border/80 bg-[#0E2A49] text-white p-6 sm:p-8 print:hidden transition-colors">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-white p-1">
                    <MunicipalCrest className="h-full w-full" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight font-heading">Municipalidad de Tres de Febrero</h4>
                    <p className="text-xs text-[#B8D0EB]">Secretaría de Desarrollo Humano y Hábitat</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#B8D0EB]">
                  <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                  <Link href="/cases" className="hover:text-white transition-colors">Expedientes</Link>
                  <Link href="/ficha-social" className="hover:text-white transition-colors">Ficha Social 360°</Link>
                  <Link href="/maps" className="hover:text-white transition-colors">Mapa Social</Link>
                  <Link href="/admin/war-room" className="hover:text-white transition-colors">Sala de Situación</Link>
                </div>
              </div>

              <div className="h-px w-full bg-white/10" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F69321] block mb-1">Sede Caseros</span>
                  <p className="text-[#B8D0EB]">Juan Bautista Alberdi 4840</p>
                  <p className="text-[#B8D0EB]/80">Caseros, Provincia de Buenos Aires</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F69321] block mb-1">Sede Ciudadela</span>
                  <p className="text-[#B8D0EB]">Av. Rivadavia y San Martín</p>
                  <p className="text-[#B8D0EB]/80">Ciudadela, Provincia de Buenos Aires</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F69321] block mb-1">Contacto Oficial</span>
                  <p className="text-[#B8D0EB]">📞 147 (desde el distrito)</p>
                  <p className="text-[#B8D0EB]">📞 0800-888-4448</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F69321] block mb-1">Atención Municipal</span>
                  <p className="text-[#B8D0EB]">Lunes a viernes 9:00 a 15:00 hs</p>
                  <p className="text-[#B8D0EB]/80">www.tresdefebrero.gov.ar</p>
                </div>
              </div>

              <div className="h-px w-full bg-white/10" />

              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-[#B8D0EB]/80">
                <p>© 2026 Municipalidad de Tres de Febrero — Todos los derechos reservados</p>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#13B423]" />
                  <span className="font-semibold text-white">MuniGestión 3F • Sistema Municipal</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </Providers>
  );
}
