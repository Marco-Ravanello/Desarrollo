import React from "react";
import { Button } from "@/components/ui/button";
import {
  Users, Briefcase, Car, ClipboardList, Search,
  Calendar, Package, Sparkles, Plus, RefreshCw, FolderSearch
} from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  type?: "people" | "orders" | "vehicles" | "tasks" | "stock" | "search" | "calendar" | "default";
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  className?: string;
}

const iconsMap = {
  people: Users,
  orders: Briefcase,
  vehicles: Car,
  tasks: ClipboardList,
  stock: Package,
  search: FolderSearch,
  calendar: Calendar,
  default: Sparkles,
};

const defaultTexts = {
  people: {
    title: "No hay ciudadanos o familias registradas",
    description: "Comience creando el primer legajo digital o importe datos masivos desde una planilla Excel.",
    actionLabel: "Nueva Persona",
    actionHref: "/people/new"
  },
  orders: {
    title: "No hay órdenes de compra registradas",
    description: "Las órdenes generadas para contrataciones y adquisiciones de insumos aparecerán detalladas aquí.",
    actionLabel: "Nueva Orden de Compra",
    actionHref: "/admin/purchase-orders/new"
  },
  vehicles: {
    title: "No hay vehículos en la flota actualmente",
    description: "Registre camionetas, combis o móviles municipales para controlar services, combustible y asignaciones.",
    actionLabel: "Registrar Vehículo",
    actionHref: "/admin/vehicles/new"
  },
  tasks: {
    title: "¡Todo al día! No hay tareas pendientes",
    description: "No tienes asignaciones territoriales ni trámites pendientes de resolución en este momento.",
    actionLabel: "Crear Nueva Tarea",
    actionHref: "/tasks"
  },
  stock: {
    title: "Sin insumos en el depósito",
    description: "Registre los materiales de construcción, alimentos o insumos de emergencia para controlar el inventario.",
    actionLabel: "Cargar Insumo",
    actionHref: "/admin/stock"
  },
  search: {
    title: "No se encontraron resultados",
    description: "Intente buscar con otros términos, revise la ortografía o limpie los filtros aplicados.",
    actionLabel: "Limpiar Búsqueda",
  },
  calendar: {
    title: "No hay eventos programados",
    description: "Planifique operativos territoriales, reuniones de gabinete o audiencias públicas en la agenda.",
    actionLabel: "Agendar Evento",
  },
  default: {
    title: "No hay registros disponibles",
    description: "Aún no se ha cargado información en esta sección del sistema.",
    actionLabel: "Crear Registro",
  }
};

export function EmptyState({
  type = "default",
  title,
  description,
  actionLabel,
  actionHref,
  onActionClick,
  secondaryActionLabel,
  onSecondaryActionClick,
  className = ""
}: EmptyStateProps) {
  const IconComponent = iconsMap[type] || iconsMap.default;
  const config = defaultTexts[type] || defaultTexts.default;

  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;
  const displayActionHref = actionHref || config.actionHref;

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-[2.5rem] bg-card/60 border border-border/60 shadow-xs relative overflow-hidden backdrop-blur-xs ${className}`}>
      <div className="absolute w-48 h-48 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5 text-primary group-hover:scale-105 transition-transform duration-300">
          <IconComponent className="h-9 w-9 stroke-[1.75]" />
        </div>
        <div className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full shadow-sm">
          <div className="w-3.5 h-3.5 rounded-full bg-primary/40" />
        </div>
      </div>

      <div className="max-w-md space-y-2 mb-8 relative z-10">
        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
          {displayTitle}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
          {displayDescription}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
        {displayActionLabel && (
          displayActionHref ? (
            <Button asChild className="rounded-2xl h-11 px-6 font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:scale-102 transition-transform">
              <Link href={displayActionHref}>
                <Plus className="mr-2 h-4 w-4" /> {displayActionLabel}
              </Link>
            </Button>
          ) : (
            <Button
              onClick={onActionClick}
              className="rounded-2xl h-11 px-6 font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:scale-102 transition-transform"
            >
              <Plus className="mr-2 h-4 w-4" /> {displayActionLabel}
            </Button>
          )
        )}

        {secondaryActionLabel && (
          <Button
            variant="outline"
            onClick={onSecondaryActionClick}
            className="rounded-2xl h-11 px-5 font-bold text-xs border-border/60 hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
