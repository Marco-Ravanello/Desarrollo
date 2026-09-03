import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  accessorKey: string;
}

export function exportToExcel(data: any[], filename: string = "exportacion", sheetName: string = "Datos") {
  if (!data || data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename?: string;
  orientation?: "portrait" | "landscape";
}

export function exportToPdf({
  title,
  subtitle = "REPORTE OFICIAL DE GESTIÓN MUNICIPAL",
  columns,
  data,
  filename = "reporte_municipal",
  orientation = "portrait"
}: ExportPdfOptions) {
  if (!data || data.length === 0) return;

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timeStr = now.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // Membrete Institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, doc.internal.pageSize.width, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MUNICIPALIDAD DE GESTIÓN TERRITORIAL", 14, 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle.toUpperCase(), 14, 17);

  doc.text(`EMISIÓN: ${dateStr} ${timeStr} HS`, doc.internal.pageSize.width - 14, 14, { align: "right" });

  // Título principal
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 34);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 37, doc.internal.pageSize.width - 14, 37);

  // Mapear filas
  const tableRows = data.map((item) =>
    columns.map((col) => {
      const val = item[col.accessorKey];
      if (val === null || val === undefined) return "-";
      if (typeof val === "boolean") return val ? "SÍ" : "NO";
      return String(val);
    })
  );

  const tableHeaders = [columns.map((c) => c.header)];

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: 42,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
      halign: "left"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { top: 42, left: 14, right: 14, bottom: 20 },
    didDrawPage: (dataArg) => {
      // Paginación
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${dataArg.pageNumber} de ${pageCount} - Documento Oficial de Uso Interno Municipal`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }
  });

  doc.save(`${filename}_${now.toISOString().split("T")[0]}.pdf`);
}
