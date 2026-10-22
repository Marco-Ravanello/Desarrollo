"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBreadcrumbs, BreadcrumbItem } from "./breadcrumbs-context";
import { Home, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NEW_LABELS: Record<string, string> = {
  cases: "Nuevo expediente",
  people: "Cargar persona",
  vehicles: "Nuevo vehículo",
  "purchase-orders": "Nueva orden",
  agreements: "Nuevo convenio",
};

const PATH_DICTIONARY: Record<string, string> = {
  dashboard: "Inicio",
  admin: "Administración",
  assistant: "Asistente de IA",
  users: "Usuarios",
  settings: "Configuración",
  budget: "Presupuesto y convenios",
  reports: "Reportes",
  providers: "Proveedores",
  "purchase-orders": "Órdenes de compra",
  hr: "Recursos Humanos",
  vehicles: "Vehículos",
  calendar: "Agenda",
  interventions: "Importar datos",
  "war-room": "Sala de Situación",
  emergency: "Emergencia climática",
  areas: "Áreas",
  social: "Protección Social",
  habitat: "Hábitat y Vivienda",
  ninez: "Niñez y Familia",
  violence: "Violencia de Género",
  people: "Registro Único",
  cases: "Expedientes",
  new: "Nuevo",
  maps: "Mapa Social",
  ubicar: "Ubicar en el mapa",
  "ficha-social": "Ficha Social 360°",
  "cambiar-clave": "Cambiar mi contraseña",
  derivaciones: "Derivaciones",
  duplicados: "Posibles duplicados",
  cruces: "Cruces de programas",
  tasks: "Mis tareas",
  agreements: "Convenios",
  stock: "Stock de insumos",
  audit: "Auditoría",
  fuel: "Combustible",
  reserve: "Reservar",
  requests: "Pedidos"
};

// Lo de /admin se muestra con el mismo grupo que tiene en el menú lateral.
const ADMIN_MENU_GROUP: Record<string, string> = {
  "war-room": "Operación diaria",
  calendar: "Operación diaria",
  assistant: "Operación diaria",
  emergency: "Operación diaria",
  "purchase-orders": "Compras y presupuesto",
  providers: "Compras y presupuesto",
  budget: "Compras y presupuesto",
  agreements: "Compras y presupuesto",
  reports: "Compras y presupuesto",
  vehicles: "Recursos",
  stock: "Recursos",
  hr: "Recursos",
  settings: "Sistema",
  interventions: "Sistema",
  users: "Sistema",
  audit: "Sistema",
};

// Segmentos que agrupan secciones pero no tienen una página propia: se muestran sin link.
const PATHS_WITHOUT_PAGE = new Set(["/admin", "/areas"]);

export { getAreaDashboardUrl, getAreaShortName } from "@/lib/area-theme";

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
      const dictLabel =
        segment === "new"
          ? NEW_LABELS[segments[idx - 1]] || "Nuevo"
          : segment === "admin"
            ? ADMIN_MENU_GROUP[segments[idx + 1]] || PATH_DICTIONARY[segment]
            : PATH_DICTIONARY[segment];

      let label = dictLabel || segment;

      if (!dictLabel && segment.length >= 8) {
        label = "Detalle";
      }

      return {
        label,
        href: isLast || PATHS_WITHOUT_PAGE.has(currentHref) ? undefined : currentHref,
        active: isLast
      };
    });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 py-1.5 px-3 rounded-2xl bg-card/60 border border-border/40 w-fit max-w-full backdrop-blur-xs shadow-2xs print:hidden"
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
                className="hover:text-primary font-bold transition-colors truncate min-w-0 max-w-[160px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded-lg border border-border/40 truncate min-w-0 max-w-[200px]">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
