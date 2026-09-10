"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileQuestion, Home, Users, Search, ArrowLeft,
  FolderKanban, Network, Map, ShieldAlert, Phone, HelpCircle
} from "lucide-react";
import Link from "next/link";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

export default function NotFoundPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/people?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const shortcuts = [
    {
      title: "Padrón Único y Legajos",
      desc: "Consulta unificada de ciudadanos y familias de Tres de Febrero",
      href: "/people",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/20"
    },
    {
      title: "Ficha Social Unificada 360°",
      desc: "Cruce de datos y programas sociales activos",
      href: "/ficha-social",
      icon: Network,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10 border-indigo-500/20"
    },
    {
      title: "Cartografía Social GIS",
      desc: "Mapa de geolocalización por 15 localidades",
      href: "/maps",
      icon: Map,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10 border-emerald-500/20"
    },
    {
      title: "Centro de Operaciones (COE)",
      desc: "Comando de emergencias, radar SMN y riesgo hídrico",
      href: "/admin/emergency",
      icon: ShieldAlert,
      color: "text-amber-500",
      bg: "bg-amber-500/10 border-amber-500/20"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-500 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full space-y-6 text-center relative z-10">
        <div className="flex flex-col items-center space-y-3">
          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xl relative group">
            <MunicipalCrest className="h-16 w-16" />
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1">
              <FileQuestion className="h-3.5 w-3.5" /> 404
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary">
              MUNICIPALIDAD DE TRES DE FEBRERO
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mt-1">
              Recurso No Encontrado
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-semibold mt-1 max-w-md mx-auto leading-relaxed">
              La dirección web ingresada no corresponde a una vista activa o la carátula solicitada fue reubicada en la plataforma.
            </p>
          </div>
        </div>

        <Card className="bg-card text-card-foreground border border-border/60 shadow-lg rounded-3xl p-5 sm:p-6 text-left">
          <CardContent className="p-0 space-y-4">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" /> Búsqueda Rápida en Padrón Municipal
              </label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Escriba DNI, Apellido o Expediente (ej: 34438385)..."
                  className="h-11 text-xs sm:text-sm rounded-2xl bg-muted/30 border-border/60 text-foreground font-medium"
                />
                <Button type="submit" className="h-11 px-5 rounded-2xl font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground gap-2 shrink-0">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
              </div>
            </form>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Button
                variant="default"
                asChild
                className="rounded-2xl h-11 px-5 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground gap-2"
              >
                <Link href="/dashboard">
                  <Home className="h-4 w-4" /> Ir al Panel Principal
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="rounded-2xl h-11 px-5 text-xs font-bold gap-2 border-border/60"
              >
                <Link href="/people">
                  <Users className="h-4 w-4 text-primary" /> Ir al Padrón Único
                </Link>
              </Button>

              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="rounded-2xl h-11 px-4 text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Volver Atrás
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 text-left">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground pl-1">
            Accesos Directos Módulos Oficiales
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shortcuts.map((s, idx) => (
              <Link
                key={idx}
                href={s.href}
                className="p-3.5 rounded-2xl border border-border/40 bg-card hover:border-primary/50 hover:bg-muted/40 transition-all group flex items-start gap-3"
              >
                <div className={`p-2.5 rounded-xl border ${s.bg} ${s.color} shrink-0 group-hover:scale-110 transition-transform`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                    {s.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold">Soporte y Mesa de Ayuda Interna:</span>
          </div>
          <span className="font-mono font-bold text-foreground flex items-center gap-1">
            <Phone className="h-3 w-3 text-emerald-500" /> Interno 2244 (Municipalidad)
          </span>
        </div>
      </div>
    </div>
  );
}
