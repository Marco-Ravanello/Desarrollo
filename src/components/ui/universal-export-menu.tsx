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
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
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
  /** Si está, los datos se piden recién al exportar (por ejemplo, al servidor). Devuelve null si no se pudo. */
  loadData?: () => Promise<any[] | null>;
  /** Más filas que esto no entran en un PDF legible: se sugiere Excel. */
  pdfMaxRows?: number;
}

export function UniversalExportMenu({
  data,
  columns,
  filename = "exportacion_municipal",
  title = "Reporte de Datos Municipales",
  subtitle = "SISTEMA INTEGRADO DE GESTIÓN MUNICIPAL",
  orientation = "portrait",
  label = "Exportar Planilla",
  loadData,
  pdfMaxRows
}: UniversalExportMenuProps) {
  const [loading, setLoading] = useState(false);

  const getRows = async () => {
    if (!loadData) return data;
    setLoading(true);
    try {
      return await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleExcelExport = async () => {
    const data = await getRows();
    if (!data && loadData) return;
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

  const handlePdfExport = async () => {
    const data = await getRows();
    if (!data && loadData) return;
    if (!data || data.length === 0) {
      toast.error("No hay registros disponibles para exportar");
      return;
    }
    if (pdfMaxRows && data.length > pdfMaxRows) {
      toast.error(`Son ${data.length.toLocaleString("es-AR")} registros: para más de ${pdfMaxRows.toLocaleString("es-AR")} usá la planilla Excel.`);
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
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Download className="h-3.5 w-3.5 text-primary" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl bg-card border-border/60 shadow-xl p-1">
        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1.5">
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
