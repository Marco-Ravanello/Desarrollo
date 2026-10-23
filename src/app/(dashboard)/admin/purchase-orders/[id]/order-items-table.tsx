"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PackageCheck, ChevronRight, ShoppingBag, ClipboardList } from "lucide-react";
import { RecordFulfillmentSheet } from "./record-fulfillment-sheet";
import { Badge } from "@/components/ui/badge";

interface OrderItemsTableProps {
  orderId: string;
  orderStatus: string;
  items: any[];
  /** Puede registrar entregas (Auditoría solo consulta). */
  canRecord: boolean;
}

export function OrderItemsTable({ orderId, orderStatus, items, canRecord }: OrderItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const canEdit = canRecord && (orderStatus === "APROBADA" || orderStatus === "CUMPLIDA");
  const totalItems = items.length;
  const fulfilledItems = items.filter(i => Number(i.fulfilledQuantity) >= Number(i.quantity)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Renglones detallados</h3>
            <p className="text-xs text-muted-foreground font-bold">
              {totalItems} renglones adjudicados • {fulfilledItems} completados
            </p>
          </div>
        </div>

        {orderStatus === "CUMPLIDA" && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20">
            <PackageCheck className="h-3.5 w-3.5" /> Orden totalmente cumplida
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px] table-auto border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                <th className="w-16 text-center py-4 px-4 font-bold text-muted-foreground text-xs">
                  Reng.
                </th>
                <th className="w-24 text-center py-4 px-4 font-bold text-muted-foreground text-xs">
                  Cant.
                </th>
                <th className="w-28 text-center py-4 px-4 font-bold text-muted-foreground text-xs">
                  Unidad
                </th>
                <th className="text-left py-4 px-6 font-bold text-muted-foreground text-xs min-w-[300px]">
                  Descripción del bien / servicio
                </th>
                <th className="w-52 text-left py-4 px-5 font-bold text-muted-foreground text-xs">
                  Avance de entrega
                </th>
                <th className="w-36 text-right py-4 px-5 font-bold text-muted-foreground text-xs">
                  P. unitario
                </th>
                <th className="w-40 text-right py-4 px-6 font-bold text-muted-foreground text-xs">
                  Subtotal
                </th>
                {canEdit && <th className="w-32 py-4 px-4 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((item, idx) => {
                const q = Number(item.quantity);
                const f = Number(item.fulfilledQuantity);
                const progress = Math.min(100, q > 0 ? (f / q) * 100 : 0);
                const isFulfilled = f >= q && q > 0;

                return (
                  <tr key={idx} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-4 text-center align-top">
                      <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center align-top">
                      <span className="font-bold text-foreground text-base tabular-nums">
                        {q.toLocaleString("es-AR")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center align-top">
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold text-xs px-2.5 py-0.5">
                        {item.unitOfMeasure || "UNIDAD"}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 align-top">
                      <p className="text-foreground text-xs font-semibold leading-relaxed whitespace-pre-line">
                        {item.description}
                      </p>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <div className="space-y-1.5 min-w-[180px]">
                        <div className="flex justify-between text-xs font-bold tracking-tight">
                          <span className={isFulfilled ? "text-emerald-700 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}>
                            {f.toLocaleString("es-AR")} de {q.toLocaleString("es-AR")}
                          </span>
                          <span className={isFulfilled ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-muted-foreground"}>
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isFulfilled ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right tabular-nums text-muted-foreground font-semibold align-top text-xs">
                      <span className="text-xs mr-0.5">$</span>
                      {Number(item.unitPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right tabular-nums font-bold text-foreground align-top text-sm">
                      <span className="text-xs mr-0.5 font-bold text-muted-foreground">$</span>
                      {Number(item.totalPrice).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                    {canEdit && (
                      <td className="py-4 px-4 text-center align-top">
                        {!isFulfilled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-800 dark:text-blue-400 transition-all rounded-xl"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsSheetOpen(true);
                            }}
                          >
                            Registrar
                          </Button>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-xs bg-emerald-500/10 py-1.5 px-3 rounded-xl border border-emerald-500/20">
                            <PackageCheck className="h-3.5 w-3.5" /> Listo
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-border/60">
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="py-5 px-6 text-right font-bold text-muted-foreground text-xs">
                  Total:
                </td>
                <td className="py-5 px-6 text-right font-bold text-xl text-foreground tabular-nums">
                  <span className="text-sm mr-1 text-muted-foreground font-bold">$</span>
                  {items
                    .reduce((acc, item) => acc + Number(item.totalPrice), 0)
                    .toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </td>
                {canEdit && <td className="py-5 px-4"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {selectedItem && (
        <RecordFulfillmentSheet
          orderId={orderId}
          item={{
            id: selectedItem.id,
            description: selectedItem.description,
            quantity: Number(selectedItem.quantity),
            fulfilledQuantity: Number(selectedItem.fulfilledQuantity),
            unitOfMeasure: selectedItem.unitOfMeasure || "UNIDAD"
          }}
          open={isSheetOpen}
          onOpenChange={(open) => {
            setIsSheetOpen(open);
            if (!open) setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
