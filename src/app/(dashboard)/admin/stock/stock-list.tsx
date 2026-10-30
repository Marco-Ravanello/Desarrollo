"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction } from "@/app/(dashboard)/admin/actions/stock-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { AlertTriangle, Package, Download } from "lucide-react";
import { EmptyMessage } from "@/components/ui/empty-message";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatFechaHora } from "@/lib/fechas";
import { getAreaShortName } from "@/lib/area-theme";

export function StockList({ supplies: all, canEdit }: { supplies: any[]; canEdit: boolean }) {
  const router = useRouter();
  // Lo que hay que reponer, arriba; el resto por nombre (como viene).
  const supplies = [...all].sort((a, b) => Number(b.stock <= b.minStock) - Number(a.stock <= a.minStock));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<number>(0);

  const handleAdjust = async (id: string) => {
    try {
      const result = await adjustStockAction(id, tempStock);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock actualizado.");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar el stock. Revisá la conexión y probá de nuevo.");
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF() as any;
    doc.text("Inventario de insumos", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado el ${formatFechaHora(new Date())} hs`, 14, 22);

    const tableData = supplies.map((s) => [
      s.name,
      s.area?.name || "Depósito general",
      s.stock.toString(),
      s.minStock.toString(),
      s.stock <= s.minStock ? "Reponer" : "Alcanza",
    ]);

    doc.autoTable({
      head: [["Insumo", "Área", "Hay", "Mínimo", "Estado"]],
      body: tableData,
      startY: 30,
    });

    doc.save("inventario-municipal.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPDF} disabled={supplies.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Descargar PDF
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Hay</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit && (
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {supplies.map((item) => {
            const low = item.stock <= item.minStock;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.area ? getAreaShortName(item.area.name) : "Depósito general"}
                </TableCell>
                <TableCell>
                  {editingId === item.id ? (
                    <Input
                      type="number"
                      min="0"
                      aria-label={`Cuántos hay de ${item.name}`}
                      className="h-8 w-24"
                      value={Number.isFinite(tempStock) ? tempStock : ""}
                      onChange={(e) => setTempStock(parseInt(e.target.value))}
                    />
                  ) : (
                    <span className="tabular-nums">
                      <span className={`font-semibold ${low ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>{item.stock}</span>
                      <span className="text-xs text-muted-foreground"> · mínimo {item.minStock}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {low ? (
                    <StatusBadge tone="red" icon={AlertTriangle}>Para reponer</StatusBadge>
                  ) : (
                    <StatusBadge tone="green">Alcanza</StatusBadge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right tabular-nums">
                    {editingId === item.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => handleAdjust(item.id)}>
                          Guardar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(item.id);
                          setTempStock(item.stock);
                        }}
                      >
                        Ajustar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {supplies.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4}>
                <EmptyMessage
                  icon={Package}
                  title="Todavía no hay insumos cargados"
                  description={
                    canEdit ? "Cargá el primero con el botón Nuevo insumo." : "Los carga Administración General. Cuando haya, aparecen acá."
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
