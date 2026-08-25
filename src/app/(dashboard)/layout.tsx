import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EmergencyHeaderWidget } from "@/components/emergency/emergency-header-widget";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { PrintHeader, PrintFooter } from "@/components/ui/print-layout";
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
        <aside className="print:hidden">
          <AppSidebar />
        </aside>
        <main className="flex-1 min-w-0 print:p-0">
          <header className="h-16 sticky top-0 z-40 border-b border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sm:px-8 shadow-xs text-foreground print:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 bg-primary/10 rounded-xl border border-primary/20 shrink-0 hidden sm:flex">
                <MunicipalCrest className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider truncate">
                  Secretaría de Desarrollo Humano y Hábitat
                </h1>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest truncate hidden md:block">
                  Municipalidad • Sistema Integrado de Gestión Pública
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
            </div>
          </header>

          <div className="p-6 sm:p-8 bg-background/40 print:bg-white print:p-0">
            <PrintHeader />
            {children}
            <PrintFooter />
          </div>
        </main>
      </div>
    </Providers>
  );
}
