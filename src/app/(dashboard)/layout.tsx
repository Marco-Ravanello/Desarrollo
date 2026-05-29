import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/providers/session-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-slate-50 relative">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <header className="h-16 border-b bg-white flex items-center px-8 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-800">
              Municipio - Gestión de Desarrollo Humano y Hábitat
            </h1>
          </header>
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
