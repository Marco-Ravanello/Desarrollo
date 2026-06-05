"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Download, Filter } from "lucide-react";
import { useState } from "react";

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
          new Date(r.date).toLocaleDateString(),
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
           <h2 className="text-xl">Reporte Mensual de Combustible - {selectedMonth}</h2>
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
                   <CardTitle className="text-lg">{v.brand} {v.model} - <span className="font-mono uppercase">{v.plate}</span></CardTitle>
                   <div className="text-right">
                     <p className="text-xs text-slate-500">Tarjeta: {v.fuelCardNumber || "N/A"}</p>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="pt-4">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Fecha</TableHead>
                       <TableHead>Ticket</TableHead>
                       <TableHead>Litros</TableHead>
                       <TableHead className="text-right">Importe</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {monthlyRecords.map((r: any) => (
                       <TableRow key={r.id}>
                         <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                         <TableCell className="font-mono text-xs">{r.ticketNumber}</TableCell>
                         <TableCell>{Number(r.liters).toFixed(2)} L</TableCell>
                         <TableCell className="text-right font-bold">${Number(r.amount).toLocaleString()}</TableCell>
                       </TableRow>
                     ))}
                     <TableRow className="bg-slate-50 dark:bg-slate-900 font-bold">
                        <TableCell colSpan={2}>TOTAL DEL MES</TableCell>
                        <TableCell>{totalLiters.toFixed(2)} L</TableCell>
                        <TableCell className="text-right">${totalSpent.toLocaleString()}</TableCell>
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
           <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl">
              No hay registros de combustible para el período seleccionado.
           </div>
        )}
      </div>
    </div>
  );
}
