"use client";

import { useState } from "react";
import { adjustStockAction } from "@/app/(dashboard)/admin/actions/stock-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Save, Package, Download } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export function StockList({ supplies }: { supplies: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<number>(0);

  const handleAdjust = async (id: string) => {
    try {
      await adjustStockAction(id, tempStock);
      toast.success("Stock actualizado");
      setEditingId(null);
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF() as any;
    doc.text("Reporte de Inventario - Municipio", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = supplies.map(s => [
      s.name,
      s.area?.name || "Depósito General",
      s.stock.toString(),
      s.minStock.toString(),
      s.stock <= s.minStock ? "BAJO" : "OK"
    ]);

    doc.autoTable({
      head: [["Insumo", "Área", "Stock", "Mín.", "Estado"]],
      body: tableData,
      startY: 30,
    });

    doc.save("inventario-municipal.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPDF}>
          <Download className="h-4 w-4 mr-2" /> Descargar PDF
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {supplies.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">{item.description}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{item.area?.name || "Gral."}</Badge>
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    type="number"
                    className="w-20 h-8"
                    value={tempStock}
                    onChange={(e) => setTempStock(parseInt(e.target.value))}
                  />
                ) : (
                  <span className={`font-mono font-bold ${item.stock <= item.minStock ? "text-rose-600" : ""}`}>
                    {item.stock}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {item.stock <= item.minStock ? (
                  <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                    <AlertTriangle className="h-3 w-3" /> BAJO
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-600">OK</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {editingId === item.id ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>X</Button>
                    <Button size="sm" onClick={() => handleAdjust(item.id)}><Save className="h-4 w-4"/></Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(item.id);
                      setTempStock(item.stock);
                    }}
                  >
                    Ajustar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {supplies.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                No hay insumos registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
