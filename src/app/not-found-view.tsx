"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderKanban, Home, Map, Phone, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

const SHORTCUTS = [
  { title: "Inicio", desc: "Lo tuyo del día", href: "/dashboard", icon: Home },
  { title: "Registro Único", desc: "Las personas del padrón y su ficha", href: "/people", icon: Users },
  { title: "Expedientes", desc: "Los casos abiertos y su historia", href: "/cases", icon: FolderKanban },
  { title: "Mapa Social", desc: "Dónde vive la gente, por barrio y programa", href: "/maps", icon: Map },
];

export function NotFoundView({ helpdeskPhone }: { helpdeskPhone: string }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/people?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground sm:p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <MunicipalCrest className="h-14 w-14" />
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">No encontramos esta página</h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Puede que el enlace esté mal escrito o que la página ya no exista. Buscá a la persona o elegí adónde ir.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar en el padrón"
              placeholder="Buscar por DNI o apellido"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Button type="submit" className="h-10 shrink-0">
            Buscar
          </Button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button variant="ghost" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a la página anterior
          </Button>
          {helpdeskPhone.trim() && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" /> ¿Necesitás ayuda? Llamá a Mesa de ayuda:{" "}
              <span className="font-semibold text-foreground">{helpdeskPhone}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
