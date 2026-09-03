"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPdf, ExportColumn } from "@/lib/export-utils";
import { toast } from "sonner";

interface UniversalExportMenuProps {
  data: any[];
  columns: ExportColumn[];
  filename?: string;
  title?: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  label?: string;
}

export function UniversalExportMenu({
  data,
  columns,
  filename = "exportacion_municipal",
  title = "Reporte de Datos Municipales",
  subtitle = "SISTEMA INTEGRADO DE GESTIÓN MUNICIPAL",
  orientation = "portrait",
  label = "Exportar Planilla"
}: UniversalExportMenuProps) {

  const handleExcelExport = () => {
    if (!data || data.length === 0) {
      toast.error("No hay registros disponibles para exportar");
      return;
    }

    try {
      // Filtrar y renombrar claves según columnas
      const formattedData = data.map(row => {
        const item: Record<string, any> = {};
        columns.forEach(col => {
          item[col.header] = row[col.accessorKey] ?? "-";
        });
        return item;
      });

      exportToExcel(formattedData, filename);
      toast.success("Planilla Excel descargada correctamente");
    } catch (error) {
      toast.error("Error al exportar a Excel");
    }
  };

  const handlePdfExport = () => {
    if (!data || data.length === 0) {
      toast.error("No hay registros disponibles para exportar");
      return;
    }

    try {
      exportToPdf({
        title,
        subtitle,
        columns,
        data,
        filename,
        orientation
      });
      toast.success("Reporte PDF generado correctamente");
    } catch (error) {
      toast.error("Error al generar el reporte PDF");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl border-border/60 hover:bg-muted font-bold text-xs gap-2 h-9"
        >
          <Download className="h-3.5 w-3.5 text-primary" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl bg-card border-border/60 shadow-xl p-1">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1.5">
          Opciones de Exportación
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/40" />
        <DropdownMenuItem
          onClick={handleExcelExport}
          className="rounded-xl text-xs font-bold gap-2 cursor-pointer focus:bg-muted"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Planilla Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handlePdfExport}
          className="rounded-xl text-xs font-bold gap-2 cursor-pointer focus:bg-muted"
        >
          <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          Reporte Oficial (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
