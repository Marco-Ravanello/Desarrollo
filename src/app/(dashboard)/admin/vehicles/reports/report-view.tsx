"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Download, Filter } from "lucide-react";
import { useState } from "react";
import { EmptyMessage } from "@/components/ui/empty-message";
import { formatFecha } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";

export function FuelReportView({ vehicles }: { vehicles: any[] }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Fecha", "Vehículo", "Patente", "Ticket", "Litros", "Importe"];
    const rows: string[][] = [];

    vehicles.forEach(v => {
      const monthlyRecords = (v.fuelRecords || []).filter((r: any) => {
        const recordDate = new Date(r.date);
        const recordMonth = recordDate.toISOString().slice(0, 7);
        return recordMonth === selectedMonth;
      });

      monthlyRecords.forEach((r: any) => {
        rows.push([
          formatFecha(r.date),
          `${v.brand} ${v.model}`,
          v.plate,
          r.ticketNumber || "",
          r.liters.toString(),
          r.amount.toString()
        ]);
      });
    });

    if (rows.length === 0) return;

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte-combustible-${selectedMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div className="flex gap-2 items-center">
          <input
            aria-label="Mes del reporte"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1"
          />
          <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1"/> Filtrar</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1"/> Imprimir PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1"/> Exportar CSV</Button>
        </div>
      </div>

      <div className="space-y-8 print:block">
        <div className="hidden print:block text-center mb-8 border-b pb-4">
           <h1 className="text-2xl font-bold">Dirección General de Desarrollo Humano y Hábitat</h1>
           <h2 className="text-xl">Combustible del mes {selectedMonth}</h2>
        </div>

        {vehicles.map(v => {
           const monthlyRecords = (v.fuelRecords || []).filter((r: any) => {
             const recordDate = new Date(r.date);
             const recordMonth = recordDate.toISOString().slice(0, 7);
             return recordMonth === selectedMonth;
           });
           const totalSpent = monthlyRecords.reduce((acc: number, r: any) => acc + Number(r.amount), 0);
           const totalLiters = monthlyRecords.reduce((acc: number, r: any) => acc + Number(r.liters), 0);

           if (monthlyRecords.length === 0) return null;

           return (
             <Card key={v.id} className="print:shadow-none print:border-slate-300">
               <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                 <div className="flex justify-between items-center">
                   <CardTitle className="text-lg">{v.brand} {v.model} - {v.plate}</CardTitle>
                   <div className="text-right">
                     <p className="text-xs text-muted-foreground">Tarjeta: {v.fuelCardNumber || "sin tarjeta"}</p>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="pt-4">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Fecha</TableHead>
                       <TableHead>Ticket</TableHead>
                       <TableHead numeric>Litros</TableHead>
                       <TableHead className="text-right">Importe</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {monthlyRecords.map((r: any) => (
                       <TableRow key={r.id}>
                         <TableCell>{formatFecha(r.date)}</TableCell>
                         <TableCell className="text-xs">{r.ticketNumber}</TableCell>
                         <TableCell numeric>{Number(r.liters).toFixed(2)} L</TableCell>
                         <TableCell className="text-right font-bold tabular-nums">{formatPesos(Number(r.amount))}</TableCell>
                       </TableRow>
                     ))}
                     <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                        <TableCell colSpan={2}>Total del mes</TableCell>
                        <TableCell numeric>{totalLiters.toFixed(2)} L</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPesos(totalSpent)}</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
               </CardContent>
             </Card>
           );
        })}

        {vehicles.every(v => (v.fuelRecords || []).filter((r: any) => {
           const recordDate = new Date(r.date);
           const recordMonth = recordDate.toISOString().slice(0, 7);
           return recordMonth === selectedMonth;
        }).length === 0) && (
           <EmptyMessage
             className="rounded-xl border-2 border-dashed border-border/60"
             kind="search"
             title="No hay cargas de combustible en este período"
             description="Probá con otras fechas."
           />
        )}
      </div>
    </div>
  );
}
