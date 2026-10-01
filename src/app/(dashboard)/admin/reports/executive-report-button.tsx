"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { getWeeklyExecutiveData } from "./actions/report-actions";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { toast } from "sonner";

export function ExecutiveReportButton() {
  const [loading, setLoading] = useState(false);

  const generatePDF = async () => {
    setLoading(true);
    try {
      const data = await getWeeklyExecutiveData();
      const doc = new jsPDF();

      // Header prolijo institucional
      doc.setFillColor(0, 74, 128);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("REPORTES EJECUTIVOS", 14, 25);

      doc.setFontSize(10);
      doc.text("Municipalidad de Tres de Febrero - Gestión de Desarrollo Humano", 14, 32);

      // Info Section
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(12);
      doc.text(`Periodo: ${data.period}`, 14, 55);
      doc.text(`Fecha de Emisión: ${data.timestamp}`, 14, 62);

      // Content Table
      (doc as any).autoTable({
        startY: 75,
        head: [['Métrica de Gestión', 'Valor']],
        body: [
          ['Nuevos Ciudadanos con Casos', data.newCases],
          ['Intervenciones Realizadas', data.newInterventions],
          ['Presupuesto Ejecutado (OC Aprobadas)', `$${data.totalSpent.toLocaleString('es-AR')}`],
          ['Órdenes de Compra Pendientes ($)', `$${data.pendingAmount.toLocaleString('es-AR')}`],
          ['Alertas Críticas Activas', data.criticalCases],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 128] },
        styles: { fontSize: 11, cellPadding: 6 }
      });

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("Documento generado automáticamente por MuniGestión para uso interno.", 14, 280);

      doc.save(`Reporte_Ejecutivo_Semanal_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Reporte generado con éxito");
    } catch (error) {
      toast.error("Error al generar el reporte");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={generatePDF}
      disabled={loading}
      className="rounded-xl h-10 px-4 gap-1.5 border-border/80 text-foreground hover:bg-muted/50 text-xs font-bold shadow-xs cursor-pointer transition-colors"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      Reporte Semanal
    </Button>
  );
}
