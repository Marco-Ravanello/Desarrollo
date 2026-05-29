import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";

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
          <header className="h-16 border-b bg-card flex items-center px-8 shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">
              Municipio - Gestión de Desarrollo Humano y Hábitat
            </h1>
          </header>
          <div className="p-8 bg-background/50">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
