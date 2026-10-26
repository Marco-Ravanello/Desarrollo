"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, CopyCheck, Gauge, MoreHorizontal, Network, Plus, Shuffle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Botones del Registro Único: a la vista "Ficha 360°" y "Cargar persona"; el resto en "Más".
 * El panel de importación llega armado desde el servidor (importContent).
 */
export function PeopleHeaderActions({ canImport, importContent }: { canImport: boolean; importContent?: ReactNode }) {
  const [importOpen, setImportOpen] = useState(false);
  const itemClass = "rounded-xl text-sm font-medium cursor-pointer py-2 gap-2";

  return (
    <>
      <Button variant="outline" asChild className="rounded-2xl h-11 px-4 text-sm font-bold border-border/60 gap-2">
        <Link href="/ficha-social">
          <Network className="h-4 w-4 text-primary" />
          Ficha 360°
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-2xl h-11 px-4 text-sm font-bold border-border/60 gap-2">
            <MoreHorizontal className="h-4 w-4" />
            Más
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
          <DropdownMenuItem asChild className={itemClass}>
            <Link href="/ficha-social/cruces">
              <Shuffle className="h-4 w-4 text-muted-foreground" /> Cruces de programas
            </Link>
          </DropdownMenuItem>
          {canImport && (
            <DropdownMenuItem asChild className={itemClass}>
              <Link href="/people/calidad">
                <Gauge className="h-4 w-4 text-muted-foreground" /> Calidad de datos
              </Link>
            </DropdownMenuItem>
          )}
          {canImport && (
            <DropdownMenuItem asChild className={itemClass}>
              <Link href="/people/duplicados">
                <CopyCheck className="h-4 w-4 text-muted-foreground" /> Posibles duplicados
              </Link>
            </DropdownMenuItem>
          )}
          {canImport && (
            <DropdownMenuItem className={itemClass} onSelect={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 text-muted-foreground" /> Importar desde planilla
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button asChild className="rounded-2xl h-11 px-5 shadow-sm font-bold text-sm gap-2">
        <Link href="/people/new">
          <Plus className="h-4 w-4" /> Cargar persona
        </Link>
      </Button>

      {canImport && (
        <Sheet open={importOpen} onOpenChange={setImportOpen}>
          <SheetContent side="right" className="sm:max-w-xl w-full bg-card text-card-foreground rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto border-l border-border">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold">Importar desde planilla</SheetTitle>
              <SheetDescription>Sumá personas al padrón o cargá intervenciones desde una planilla.</SheetDescription>
            </SheetHeader>
            {importContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
