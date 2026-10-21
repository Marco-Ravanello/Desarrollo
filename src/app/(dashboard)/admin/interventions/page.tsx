"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import * as XLSX from "xlsx";
import { exportInterventionsAction, importInterventionsAction } from "./actions";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function InterventionsAdminPage() {
  const [exporting, setExporting] = useState(false);
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
      toast.success("Exportación completada");
    } catch {
      toast.error("No se pudo exportar. Revisá la conexión y probá de nuevo.");
    } finally {
      setExporting(false);
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
    <div className="space-y-8 max-w-5xl mx-auto">
      <PageHeader
        title="Importar datos"
        description="Subí planillas de intervenciones o descargá las que ya están cargadas."
        icon={HandHeart}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-none shadow-xl overflow-hidden group hover:shadow-2xl transition-all">
          <CardHeader className="bg-emerald-500/5">
            <div className="bg-emerald-500/15 w-12 h-12 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Download className="text-emerald-600" />
            </div>
            <CardTitle>Exportar a Excel</CardTitle>
            <CardDescription>Obtenga el listado completo de intervenciones del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Descargar Planilla
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-xl overflow-hidden group hover:shadow-2xl transition-all">
          <CardHeader className="bg-blue-500/5">
            <div className="bg-blue-500/15 w-12 h-12 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Upload className="text-blue-600" />
            </div>
            <CardTitle>Importar desde Excel</CardTitle>
            <CardDescription>Cargue datos históricos desde sus planillas actuales.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="text-xs text-muted-foreground mb-2">
              <strong>Columnas:</strong> DNI, Area, Caso, Descripcion y Fecha (dd/mm/aaaa). Nombre y Apellido solo hacen falta si la persona no está en el Registro Único ni en el padrón. Las filas incompletas no se cargan y se listan abajo con el motivo.
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImport}
                disabled={importing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button
                disabled={importing}
                variant="outline"
                className="w-full border-blue-500/30 text-blue-600 hover:bg-blue-500/10 rounded-xl"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Seleccionar Archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {results && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
           <Alert className="bg-emerald-500/10 border-emerald-500/30 rounded-2xl">
             <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
