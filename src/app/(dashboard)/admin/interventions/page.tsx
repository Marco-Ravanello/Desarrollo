"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileDown, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import * as XLSX from "xlsx";
import { exportInterventionsAction, getImportAreasAction, importInterventionsAction } from "./actions";
import { buildImportTemplate } from "@/lib/intervention-import";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function InterventionsAdminPage() {
  const [exporting, setExporting] = useState(false);
  const [preparingTemplate, setPreparingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ createdCount: number, errors: string[] } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportInterventionsAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(result.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Intervenciones");
      XLSX.writeFile(workbook, `Intervenciones_Municipal_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(result.rows.length === 1 ? "Listo, se bajó 1 intervención." : `Listo, se bajaron ${result.rows.length.toLocaleString("es-AR")} intervenciones.`);
    } catch {
      toast.error("No se pudo exportar. Revisá la conexión y probá de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  const handleTemplate = async () => {
    setPreparingTemplate(true);
    try {
      const res = await getImportAreasAction();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const template = buildImportTemplate(res.areas);
      const workbook = XLSX.utils.book_new();
      for (const sheet of template) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        ws["!cols"] = sheet.widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
      }
      XLSX.writeFile(workbook, "Planilla_modelo_intervenciones.xlsx");
    } catch {
      toast.error("No se pudo armar la planilla. Revisá la conexión y probá de nuevo.");
    } finally {
      setPreparingTemplate(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResults(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error("El archivo está vacío");
          setImporting(false);
          return;
        }

        const res = await importInterventionsAction(data as any[]);
        if (!res.success) {
          toast.error(res.errors[0]);
          return;
        }
        setResults({ createdCount: res.createdCount, errors: res.errors });
        if (res.errors.length > 0) {
          toast.warning(`Se cargaron ${res.createdCount} intervenciones. ${res.errors.length} filas no se cargaron: revisá el detalle abajo.`);
        } else {
          toast.success(`Se cargaron ${res.createdCount} intervenciones.`);
        }
      } catch (error) {
        toast.error("No se pudo leer el archivo. Revisá que sea un Excel (.xlsx o .xls).");
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar datos"
        description="Subí intervenciones desde una planilla de Excel o bajá las que ya están cargadas."
        icon={HandHeart}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <CardTitle>Subir intervenciones</CardTitle>
            <CardDescription>Cargá intervenciones que estaban en planillas. Bajá la planilla modelo, completala y subila.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Columnas:</strong> DNI, Area, Caso, Descripcion y Fecha (dd/mm/aaaa). Nombre y Apellido solo hacen falta si la persona no está en el Registro Único ni en el padrón. Las filas incompletas no se cargan y se listan abajo con el motivo.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={handleTemplate} disabled={preparingTemplate} className="w-full rounded-xl">
                {preparingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Bajar planilla modelo
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  aria-label="Elegir la planilla para subir"
                  onChange={handleImport}
                  disabled={importing}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <Button disabled={importing} className="w-full rounded-xl" tabIndex={-1}>
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Subir planilla
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Download className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <CardTitle>Bajar las intervenciones cargadas</CardTitle>
            <CardDescription>Todas las intervenciones de la app en una planilla de Excel. La descarga queda anotada en Auditoría.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full rounded-xl">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Bajar intervenciones a Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {results && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
           <Alert className="bg-emerald-500/10 border-emerald-500/30 rounded-2xl">
             <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
             <AlertTitle className="text-emerald-800 dark:text-emerald-200 font-bold">Importación terminada</AlertTitle>
             <AlertDescription className="text-emerald-700 dark:text-emerald-300">
               Se cargaron {results.createdCount} intervenciones.
             </AlertDescription>
           </Alert>

           {results.errors.length > 0 && (
             <Alert variant="destructive" className="rounded-2xl">
               <AlertCircle className="h-5 w-5" />
               <AlertTitle className="font-bold">Filas que no se cargaron ({results.errors.length})</AlertTitle>
               <AlertDescription>
                 <ul className="list-disc list-inside mt-2 text-sm max-h-40 overflow-y-auto">
                   {results.errors.map((err, idx) => (
                     <li key={idx}>{err}</li>
                   ))}
                 </ul>
               </AlertDescription>
             </Alert>
           )}
        </div>
      )}
    </div>
  );
}
