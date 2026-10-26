"use client";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import * as React from "react";
import {
  Search, Users, FileText, CheckCircle2, LayoutDashboard, MapPin,
  Briefcase, Car, Wallet, Building2, UserCog, ShieldAlert, Loader2,
  Plus, Moon, Sun, History, DollarSign, UserPlus, FilePlus, Sparkles, Clock
} from "lucide-react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccessPath } from "@/lib/permissions";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getRecentItemsAction, searchGlobalAction } from "@/app/(dashboard)/actions/search-actions";
import { forgetRecent, readRecent } from "@/lib/recent-views";
import type { RecentItem } from "@/services/recent-views";

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

  const userId = session?.user?.id;
  const [recent, setRecent] = React.useState<RecentItem[]>([]);

  // Al abrir el buscador, trae los últimos expedientes y personas que abrió este usuario.
  React.useEffect(() => {
    if (!open) return;
    const refs = readRecent(userId);
    if (refs.length === 0) {
      setRecent([]);
      return;
    }
    let cancelled = false;
    getRecentItemsAction(refs)
      .then((items) => {
        if (cancelled) return;
        setRecent(items);
        // Lo que ya no existe o no se puede ver se olvida.
        if (items.length < refs.length) forgetRecent(userId, items.map(({ kind, id }) => ({ kind, id })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

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
  const canOpen = (path: string) => canAccessPath(user?.role, path);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-muted-foreground bg-muted/60 dark:bg-muted/30 hover:bg-muted rounded-xl border border-border/60 transition-all group shadow-sm"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left font-medium">Buscar o ir a…</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 font-mono text-xs font-bold text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-2xl border-none shadow-2xl bg-card/95 backdrop-blur-xl">
          <DialogTitle className="sr-only">Buscador</DialogTitle>
          <Command
            shouldFilter={false}
            className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground"
          >
            <div className="flex items-center border-b px-4 py-1 bg-muted/20" cmdk-input-wrapper="">
              <Search className="mr-2 h-5 w-5 shrink-0 opacity-60 text-primary" />
              <Command.Input
                placeholder="Buscá una persona, un expediente o una sección…"
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
                <p className="font-semibold text-muted-foreground">No encontramos nada con &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-muted-foreground">Probá con el DNI, el apellido o el título del expediente.</p>
              </Command.Empty>

              {query.length < 2 && recent.length > 0 && (
                <>
                  <Command.Group heading="Vistos recientemente">
                    {recent.map((r) => (
                      <Command.Item
                        key={`${r.kind}-${r.id}`}
                        value={`reciente ${r.kind} ${r.id}`}
                        onSelect={() => navigate(r.url)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all group"
                      >
                        {r.kind === "case" ? (
                          <div className="h-9 w-9 shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center">
                            <FileText className="h-4 w-4" />
                          </div>
                        ) : (
                          <InitialsAvatar name={r.title} seed={r.dni || r.id} />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold text-sm text-foreground">{r.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {r.kind === "case" ? "Expediente" : "Persona"}
                            {r.subtitle ? ` · ${r.subtitle}` : ""}
                          </span>
                        </div>
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Separator className="my-3 h-px bg-border/50" />
                </>
              )}

              {/* Dynamic DB Search Results */}
              {query.length >= 2 && (
                <>
                  {results.citizens.length > 0 && (
                    <Command.Group heading="Personas">
                      {results.citizens.map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`${c.title} ${c.subtitle}`}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all group"
                        >
                          <InitialsAvatar name={c.title} seed={c.dni || c.id} />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{c.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.cases.length > 0 && (
                    <Command.Group heading="Expedientes">
                      {results.cases.map((c) => (
                        <Command.Item
                          key={c.id}
                          onSelect={() => navigate(c.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all group"
                        >
                          <div className="h-9 w-9 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center group-aria-selected:bg-emerald-600 group-aria-selected:text-white transition-colors">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{c.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">{c.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.hr.length > 0 && (
                    <Command.Group heading="Personal">
                      {results.hr.map((h) => (
                        <Command.Item
                          key={h.id}
                          onSelect={() => navigate(h.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all group"
                        >
                          <div className="h-9 w-9 bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded-full flex items-center justify-center group-aria-selected:bg-purple-600 group-aria-selected:text-white transition-colors">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{h.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">{h.subtitle}</span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {results.agreements.length > 0 && (
                    <Command.Group heading="Convenios">
                      {results.agreements.map((a) => (
                        <Command.Item
                          key={a.id}
                          onSelect={() => navigate(a.url)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all group"
                        >
                          <div className="h-9 w-9 bg-orange-500/15 text-orange-700 dark:text-orange-400 rounded-full flex items-center justify-center group-aria-selected:bg-orange-600 group-aria-selected:text-white transition-colors">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-foreground">{a.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">{a.subtitle}</span>
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
              <Command.Group heading="Crear">
                {canOpen("/people/new") && (
                  <Command.Item
                    onSelect={() => navigate("/people/new")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Cargar persona</span>
                      <span className="text-xs text-muted-foreground">Sumar a alguien al Registro Único</span>
                    </div>
                  </Command.Item>
                )}
                {canOpen("/admin/purchase-orders/new") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/purchase-orders/new")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                      <FilePlus className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Nueva orden de compra</span>
                      <span className="text-xs text-muted-foreground">Cargar un pedido o leer un comprobante escaneado</span>
                    </div>
                  </Command.Item>
                )}
                {canOpen("/admin/vehicles/reserve") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/vehicles/reserve")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                      <Car className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Reservar vehículo</span>
                      <span className="text-xs text-muted-foreground">Pedir un vehículo para una fecha</span>
                    </div>
                  </Command.Item>
                )}
                {canOpen("/admin/agreements/new") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/agreements/new")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400 flex items-center justify-center">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Nuevo convenio</span>
                      <span className="text-xs text-muted-foreground">Cargar un convenio con otra institución</span>
                    </div>
                  </Command.Item>
                )}
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* Navigation Group */}
              <Command.Group heading="Ir a">
                <Command.Item
                  onSelect={() => navigate("/dashboard")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                >
                  <LayoutDashboard className="h-4 w-4 text-blue-500" />
                  <span>Inicio</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/maps")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                >
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>Mapa Social</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/people")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                >
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Registro Único</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/tasks")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  <span>Mis tareas</span>
                </Command.Item>
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* Admin Modules */}
              <Command.Group heading="Administración">
                {canOpen("/admin/purchase-orders") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/purchase-orders")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <Briefcase className="h-4 w-4 text-indigo-400" />
                    <span>Órdenes de compra</span>
                  </Command.Item>
                )}
                {canOpen("/admin/vehicles") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/vehicles")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <Car className="h-4 w-4 text-teal-400" />
                    <span>Vehículos</span>
                  </Command.Item>
                )}
                {canOpen("/admin/hr") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/hr")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <Building2 className="h-4 w-4 text-sky-400" />
                    <span>Recursos Humanos</span>
                  </Command.Item>
                )}
                {canOpen("/admin/stock") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/stock")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <Briefcase className="h-4 w-4 text-emerald-400" />
                    <span>Stock de insumos</span>
                  </Command.Item>
                )}
                {isAdmin && (
                  <>
                    {canOpen("/admin/users") && (
                      <Command.Item
                        onSelect={() => navigate("/admin/users")}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                      >
                        <UserCog className="h-4 w-4 text-rose-400" />
                        <span>Usuarios</span>
                      </Command.Item>
                    )}
                    {canOpen("/admin/audit") && (
                      <Command.Item
                        onSelect={() => navigate("/admin/audit")}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                      >
                        <History className="h-4 w-4 text-amber-400" />
                        <span>Auditoría</span>
                      </Command.Item>
                    )}
                    {canOpen("/admin/budget") && (
                      <Command.Item
                        onSelect={() => navigate("/admin/budget")}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                      >
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        <span>Presupuesto</span>
                      </Command.Item>
                    )}
                  </>
                )}
              </Command.Group>

              <Command.Separator className="my-3 h-px bg-border/50" />

              {/* System & Preference Commands */}
              <Command.Group heading="Otros">
                <Command.Item
                  onSelect={toggleTheme}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-400" />
                  )}
                  <span>{theme === "dark" ? "Pasar a modo claro" : "Pasar a modo oscuro"}</span>
                </Command.Item>
                {canOpen("/admin/assistant") && (
                  <Command.Item
                    onSelect={() => navigate("/admin/assistant")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted aria-selected:bg-muted transition-all"
                  >
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <span>Asistente de IA</span>
                  </Command.Item>
                )}
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between border-t p-3.5 text-xs text-muted-foreground bg-muted/30 font-medium">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border bg-background px-1.5 py-0.5 shadow-xs">↑↓</kbd> Moverse
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border bg-background px-1.5 py-0.5 shadow-xs">↵</kbd> Abrir
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
