"use client";
import * as React from "react";
import {
  Search, Users, FileText, CheckCircle2, LayoutDashboard, MapPin,
  Briefcase, Car, Wallet, Building2, UserCog, ShieldAlert, Loader2,
  Plus, Moon, Sun, History, DollarSign, UserPlus, FilePlus, Sparkles
} from "lucide-react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchGlobalAction } from "@/app/(dashboard)/actions/search-actions";

export function GlobalSearch() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<{ citizens: any[]; cases: any[]; hr: any[]; agreements: any[] }>({
    citizens: [],
    cases: [],
    hr: [],
    agreements: []
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (query.length < 2) {
      setResults({ citizens: [], cases: [], hr: [], agreements: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchGlobalAction(query);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = (url: string) => {
    router.push(url);
    setOpen(false);
    setQuery("");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    setOpen(false);
  };

  const user = session?.user;
  const isAdmin = user?.role === "SUPERADMIN" || user?.role === "ADMIN_GENERAL" || user?.role === "DIRECCION_GENERAL";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground bg-accent/50 hover:bg-accent rounded-lg border border-border transition-all group shadow-sm hover:shadow-md"
      >
        <Search className="h-4 w-4 shrink-0 text-primary/70 group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left font-medium">Buscar o ejecutar comando...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted/80 px-1.5 font-mono text-[10px] font-semibold text-foreground/80 opacity-100 sm:flex shadow-xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-2xl border-none shadow-2xl bg-card/95 backdrop-blur-xl">
          <DialogTitle className="sr-only">Paleta de Comandos Global</DialogTitle>
          <Command
            shouldFilter={false}
            className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground"
          >
            <div className="flex items-center border-b px-4 py-1 bg-muted/20" cmdk-input-wrapper="">
              <Search className="mr-2 h-5 w-5 shrink-0 opacity-60 text-primary" />
              <Command.Input
                placeholder="Busca ciudadanos, expedientes, personal o ejecuta un comando..."
                className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
                value={query}
                onValueChange={setQuery}
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            <Command.List className="max-h-[450px] overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
              <Command.Empty className="py-12 text-center text-sm flex flex-col items-center gap-2">
                <div className="p-3 bg-muted/50 rounded-full">
                  <Search className="h-6 w-6 text-muted-foreground opacity-30" />
                </div>
                <p className="font-semibold text-muted-foreground">No se encontraron resultados para "{query}"</p>
                <p className="text-xs text-muted-foreground/60">Intenta buscar por DNI, apellido, número de expediente o comando.</p>
              </Command.Empty>

              {/* Dynamic DB Search Results */}
              {query.length >= 2 && (
                <>
                  {results.citizens.length > 0 && (
                    <Command.Group heading="Ciudadanos Registrados">
                      {results.citizens.map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`${c.title} ${c.subtitle}`}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-blue-500/15 text-blue-500 rounded-full flex items-center justify-center font-bold text-xs uppercase group-aria-selected:bg-blue-600 group-aria-selected:text-white transition-colors">
                            {c.title[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{c.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.cases.length > 0 && (
                    <Command.Group heading="Expedientes Sociales">
                      {results.cases.map((c) => (
                        <Command.Item
                          key={c.id}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center group-aria-selected:bg-emerald-600 group-aria-selected:text-white transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{c.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.hr.length > 0 && (
                    <Command.Group heading="Personal de RRHH">
                      {results.hr.map((h) => (
                        <Command.Item
                          key={h.id}
                          onSelect={() => navigate(h.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-purple-500/15 text-purple-500 rounded-full flex items-center justify-center group-aria-selected:bg-purple-600 group-aria-selected:text-white transition-colors">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{h.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">{h.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.agreements.length > 0 && (
                    <Command.Group heading="Convenios Institucionales">
                      {results.agreements.map((a) => (
                        <Command.Item
                          key={a.id}
                          onSelect={() => navigate(a.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-orange-500/15 text-orange-500 rounded-full flex items-center justify-center group-aria-selected:bg-orange-600 group-aria-selected:text-white transition-colors">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{a.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">{a.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {(results.citizens.length > 0 || results.cases.length > 0 || results.hr.length > 0 || results.agreements.length > 0) && (
                    <Command.Separator className="my-3 h-px bg-border/50" />
                  )}
                </>
              )}

              {/* Quick Creation Actions */}
              <Command.Group heading="Acciones Rápidas (Creación)">
                <Command.Item
                  onSelect={() => navigate("/people/new")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Registrar Nuevo Ciudadano</span>
                    <span className="text-[10px] text-muted-foreground">Crear legajo en el Registro Único Social</span>
                  </div>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/purchase-orders/new")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                    <FilePlus className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Nueva Orden de Compra (con OCR)</span>
                    <span className="text-[10px] text-muted-foreground">Crear solicitud o escanear comprobante con OCR</span>
                  </div>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/vehicles/reserve")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-teal-500/15 text-teal-500 flex items-center justify-center">
                    <Car className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Reservar Vehículo Municipal</span>
                    <span className="text-[10px] text-muted-foreground">Programar uso de unidad logística de la flota</span>
                  </div>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/agreements/new")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Nuevo Convenio Institucional</span>
                    <span className="text-[10px] text-muted-foreground">Registrar acuerdo marco con instituciones</span>
                  </div>
                </Command.Item>
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* Navigation Group */}
              <Command.Group heading="Navegación Principal">
                <Command.Item
                  onSelect={() => navigate("/dashboard")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <LayoutDashboard className="h-4 w-4 text-blue-500" />
                  <span>Panel de Control (Dashboard)</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/maps")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>Mapa Social GIS y Mapa de Calor</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/people")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Registro Único de Ciudadanos</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/tasks")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  <span>Mis Tareas y Agenda</span>
                </Command.Item>
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* Admin Modules */}
              <Command.Group heading="Módulos Administrativos">
                <Command.Item
                  onSelect={() => navigate("/admin/purchase-orders")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Briefcase className="h-4 w-4 text-indigo-400" />
                  <span>Gestión de Órdenes de Compra</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/vehicles")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Car className="h-4 w-4 text-teal-400" />
                  <span>Flota Logística y Combustible</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/hr")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Building2 className="h-4 w-4 text-sky-400" />
                  <span>Recursos Humanos y Nómina</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/stock")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  <span>Inventario y Stock de Depósito</span>
                </Command.Item>
                {isAdmin && (
                  <>
                    <Command.Item
                      onSelect={() => navigate("/admin/users")}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                    >
                      <UserCog className="h-4 w-4 text-rose-400" />
                      <span>Gestión de Usuarios y Roles</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => navigate("/admin/audit")}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                    >
                      <History className="h-4 w-4 text-amber-400" />
                      <span>Auditoría e Historial del Sistema</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() => navigate("/admin/budget")}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                    >
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      <span>Control de Presupuesto Anual</span>
                    </Command.Item>
                  </>
                )}
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* System & Preference Commands */}
              <Command.Group heading="Comandos de Sistema">
                <Command.Item
                  onSelect={toggleTheme}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-400" />
                  )}
                  <span>Cambiar Tema ({theme === "dark" ? "Activar Modo Claro" : "Activar Modo Oscuro"})</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/assistant")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all"
                >
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span>Abrir Asistente IA Municipal</span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between border-t p-3.5 text-xs text-muted-foreground bg-muted/30 font-medium">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border bg-background px-1.5 py-0.5 shadow-xs">↑↓</kbd> Navegar
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border bg-background px-1.5 py-0.5 shadow-xs">↵</kbd> Seleccionar
                </span>
              </div>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border bg-background px-1.5 py-0.5 shadow-xs">esc</kbd> Cerrar
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
