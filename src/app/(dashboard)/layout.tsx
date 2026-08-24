import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EmergencyHeaderWidget } from "@/components/emergency/emergency-header-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-background relative transition-colors duration-300">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <header className="h-16 sticky top-0 z-40 border-b border-border/40 bg-white/75 dark:bg-background/75 backdrop-blur-md flex items-center justify-between px-8 shadow-municipal">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
                Gestión de Desarrollo Humano y Hábitat
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <EmergencyHeaderWidget />
              <NotificationBell />
            </div>
          </header>
          <div className="p-8 bg-background/40">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
