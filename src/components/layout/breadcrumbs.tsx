"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBreadcrumbs, BreadcrumbItem } from "./breadcrumbs-context";
import { Home, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PATH_DICTIONARY: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Administración",
  assistant: "Asistente de IA",
  users: "Gestión de Usuarios",
  settings: "Configuración",
  budget: "Resumen Presupuestario",
  hr: "Recursos Humanos",
  vehicles: "Flota Vehicular",
  calendar: "Agenda Unificada",
  interventions: "Importación de Datos",
  "war-room": "Sala de Situación",
  emergency: "Centro de Operaciones",
  areas: "Áreas Sociales",
  social: "Protección Social",
  habitat: "Hábitat y Vivienda",
  ninez: "Niñez y Familia",
  violence: "Violencia de Género",
  people: "Padrón Único",
  cases: "Expedientes Sociales",
  new: "Nuevo Expediente",
  maps: "Mapa Social GIS",
  "ficha-social": "Ficha Social 360°",
  cruces: "Matriz de Cruces",
  tasks: "Mis Tareas & Pendientes"
};

export function getAreaDashboardUrl(areaName?: string): string {
  if (!areaName) return "/areas/social";
  const name = areaName.toLowerCase();
  if (name.includes("hábitat") || name.includes("habitat") || name.includes("vivienda")) {
    return "/areas/habitat";
  }
  if (name.includes("niñez") || name.includes("ninez") || name.includes("familia")) {
    return "/areas/ninez";
  }
  if (name.includes("violencia") || name.includes("género") || name.includes("genero")) {
    return "/areas/violence";
  }
  return "/areas/social";
}

export function getAreaShortName(areaName?: string): string {
  if (!areaName) return "Protección Social";
  const name = areaName.toLowerCase();
  if (name.includes("hábitat") || name.includes("habitat") || name.includes("vivienda")) {
    return "Hábitat y Vivienda";
  }
  if (name.includes("niñez") || name.includes("ninez") || name.includes("familia")) {
    return "Niñez y Familia";
  }
  if (name.includes("violencia") || name.includes("género") || name.includes("genero")) {
    return "Violencia de Género";
  }
  return "Protección Social";
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const { customItems } = useBreadcrumbs();

  if (
    pathname === "/dashboard" ||
    pathname === "/admin/assistant" ||
    pathname === "/admin/war-room" ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  let resolvedItems: BreadcrumbItem[] = [];

  if (customItems && customItems.length > 0) {
    resolvedItems = customItems;
  } else {
    const segments = pathname.split("/").filter(Boolean);
    let currentHref = "";

    resolvedItems = segments.map((segment, idx) => {
      currentHref += `/${segment}`;
      const isLast = idx === segments.length - 1;
      const dictLabel = PATH_DICTIONARY[segment];

      let label = dictLabel || segment;

      if (!dictLabel && segment.length >= 8) {
        label = `Ref: ${segment.substring(0, 8)}...`;
      }

      return {
        label,
        href: isLast ? undefined : currentHref,
        active: isLast
      };
    });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 py-1.5 px-3 rounded-2xl bg-card/60 border border-border/40 w-fit backdrop-blur-xs shadow-2xs print:hidden"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-foreground font-bold transition-colors text-muted-foreground"
      >
        <Home className="h-3.5 w-3.5 text-primary" />
        <span className="sr-only">Inicio</span>
      </Link>

      {resolvedItems.map((item, idx) => {
        const isLast = idx === resolvedItems.length - 1;

        return (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-primary font-bold transition-colors truncate max-w-[160px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-black text-foreground bg-muted/40 px-2 py-0.5 rounded-lg border border-border/40 truncate max-w-[200px]">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
