"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, BarChart2, Network, RefreshCw, Search, User } from "lucide-react";
import { cleanDni, getSuggestions, searchFichaSocialByDni, type SugerenciaBusqueda } from "@/services/ficha-social";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";

/** Buscador de la Ficha Social 360°: al elegir a alguien abre su ficha (/people/[dni]). */
export function FichaSearch() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SugerenciaBusqueda[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notFoundDni, setNotFoundDni] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openPerson = (raw: string) => {
    const dni = cleanDni(raw);
    if (dni.length < 4) {
      toast.error(suggestions.length ? "Elegí a la persona de la lista" : "Escribí un DNI o CUIL válido");
      return;
    }
    setShowSuggestions(false);
    setNotFoundDni(null);
    startTransition(async () => {
      try {
        const result = await searchFichaSocialByDni(dni);
        if (result.encontrado) router.push(`/people/${result.dni || dni}`);
        else setNotFoundDni(dni);
      } catch {
        toast.error("No se pudo consultar la ficha. Revisá la conexión y probá de nuevo.");
      }
    });
  };

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => setSuggestions(await getSuggestions(searchTerm)), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Ficha Social 360°"
        description="Buscá a una persona por DNI o nombre y abrí su ficha: sus datos, los programas que cobra, sus expedientes, su familia y la atención que recibió."
        icon={Network}
        actions={
          <Button variant="outline" asChild className="rounded-xl border-border/60 text-xs font-bold gap-2">
            <Link href="/ficha-social/cruces">
              <BarChart2 className="h-4 w-4 text-primary" />
              Cruces de programas
            </Link>
          </Button>
        }
      />

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-visible relative">
        <CardContent className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openPerson(searchTerm);
            }}
            className="flex flex-col sm:flex-row gap-3 relative"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                aria-label="DNI, CUIL o nombre"
                placeholder="DNI, CUIL, nombre o apellido (por ejemplo 34438385 o Pérez)"
                className="pl-11 h-12 rounded-2xl text-sm bg-muted/30 border-border/60 focus-visible:ring-primary text-foreground font-medium"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-border/40">
                  <div className="p-2 bg-muted/40 text-xs font-bold text-muted-foreground">Personas encontradas</div>
                  {suggestions.map((sugg) => (
                    <button
                      key={`${sugg.dni}-${sugg.origen}`}
                      type="button"
                      onClick={() => {
                        setSearchTerm(sugg.dni);
                        openPerson(sugg.dni);
                      }}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-foreground group-hover:text-primary">{sugg.nombre}</span>
                          <span className="text-muted-foreground ml-2 font-mono">DNI {sugg.dni}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground truncate max-w-[200px]">
                        {sugg.origen}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={isPending} className="h-12 px-6 rounded-2xl font-bold text-xs gap-2 shrink-0 shadow-sm">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Abrir ficha</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {notFoundDni ? (
        <Card className="bg-card border border-border/60 rounded-2xl">
          <EmptyMessage
            kind="search"
            title={`No encontramos a nadie con DNI ${notFoundDni}`}
            description="No figura en el padrón, en el Registro Único ni en las fichas de emergencia. Revisá que el número esté bien escrito."
            icon={AlertCircle}
            className="py-12"
          />
        </Card>
      ) : (
        <Card className="bg-card border border-border/60 shadow-xs rounded-2xl p-8 sm:p-12 text-center text-muted-foreground">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Network className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">Una sola ficha por persona</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Escribí el DNI o el apellido y elegí a la persona. Se abre su ficha con todo junto, en pestañas.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
