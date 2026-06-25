"use client";

import * as React from "react";
import { Search, Users, FileText, CheckCircle2, LayoutDashboard, MapPin, Briefcase, Car, Wallet, Building2, UserCog, ShieldAlert, Loader2 } from "lucide-react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchGlobalAction } from "@/app/(dashboard)/actions/search-actions";

export function GlobalSearch() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<{ citizens: any[], cases: any[], hr: any[] }>({
    citizens: [],
    cases: [],
    hr: []
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
      setResults({ citizens: [], cases: [], hr: [] });
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

  const user = session?.user;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground bg-accent/50 hover:bg-accent rounded-lg border border-border transition-all group"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-2xl border-none shadow-2xl">
          <DialogTitle className="sr-only">Buscador Global</DialogTitle>
          <Command className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
            <div className="flex items-center border-b px-4 py-1" cmdk-input-wrapper="">
              <Search className="mr-2 h-5 w-5 shrink-0 opacity-50 text-primary" />
              <Command.Input
                placeholder="Busca ciudadanos, expedientes o personal..."
                className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                value={query}
                onValueChange={setQuery}
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <Command.List className="max-h-[450px] overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
              <Command.Empty className="py-12 text-center text-sm flex flex-col items-center gap-2">
                 <div className="p-3 bg-muted rounded-full">
                    <Search className="h-6 w-6 text-muted-foreground opacity-20" />
                 </div>
                 <p className="font-medium text-muted-foreground">No se encontraron resultados para "{query}"</p>
              </Command.Empty>

              {query.length >= 2 && (
                <>
                  {results.citizens.length > 0 && (
                    <Command.Group heading="Ciudadanos">
                      {results.citizens.map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`${c.title} ${c.subtitle}`}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs uppercase group-aria-selected:bg-blue-600 group-aria-selected:text-white transition-colors">
                            {c.title[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{c.title}</span>
                            <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.cases.length > 0 && (
                    <Command.Group heading="Expedientes y Casos">
                      {results.cases.map((c) => (
                        <Command.Item
                          key={c.id}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center group-aria-selected:bg-emerald-600 group-aria-selected:text-white transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{c.title}</span>
                            <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.hr.length > 0 && (
                    <Command.Group heading="Personal Municipal">
                      {results.hr.map((h) => (
                        <Command.Item
                          key={h.id}
                          onSelect={() => navigate(h.url)}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-accent aria-selected:bg-accent transition-all group"
                        >
                          <div className="h-9 w-9 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center group-aria-selected:bg-purple-600 group-aria-selected:text-white transition-colors">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">{h.title}</span>
                            <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{h.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {(results.citizens.length > 0 || results.cases.length > 0 || results.hr.length > 0) && (
                    <Command.Separator className="my-4 h-px bg-border/50" />
                  )}
                </>
              )}

              <Command.Group heading="Navegación Rápida">
                <Command.Item
                  onSelect={() => navigate("/dashboard")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 text-blue-500" />
                  <span>Dashboard</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/maps")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>Mapa Social</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/people")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Registro Único</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/tasks")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  <span>Mis Tareas</span>
                </Command.Item>
              </Command.Group>

              <Command.Separator className="my-2 h-px bg-border" />

              <Command.Group heading="Administración">
                <Command.Item
                  onSelect={() => navigate("/admin/purchase-orders")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  <span>Órdenes de compras</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/vehicles")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <Car className="h-4 w-4 text-slate-400" />
                  <span>Vehículos</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/budget")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <Wallet className="h-4 w-4 text-slate-400" />
                  <span>Convenios</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/admin/hr")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>Recursos Humanos</span>
                </Command.Item>
              </Command.Group>

              <Command.Separator className="my-2 h-px bg-border" />

              <Command.Group heading="Áreas">
                <Command.Item
                  onSelect={() => navigate("/areas/social")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Protección Social</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/areas/ninez")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Niñez y Familia</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/areas/habitat")}
                  className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Hábitat y Vivienda</span>
                </Command.Item>
                {(user?.role === "SUPERADMIN" || user?.role === "DIRECCION_GENERAL" || user?.role === "VIOLENCIA_GENERO") && (
                  <Command.Item
                    onSelect={() => navigate("/areas/violence")}
                    className="flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer hover:bg-accent aria-selected:bg-accent transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                    <span>Violencia de Género</span>
                  </Command.Item>
                )}
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground bg-muted/30">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-background px-1">↑↓</kbd> Navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-background px-1">↵</kbd> Seleccionar
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1">esc</kbd> Cerrar
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
