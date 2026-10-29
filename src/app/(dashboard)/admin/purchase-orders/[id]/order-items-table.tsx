"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PackageCheck } from "lucide-react";
import { RecordFulfillmentSheet } from "./record-fulfillment-sheet";
import { formatNumber, formatPesosExactos, plural } from "@/lib/formato";

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
  const fulfilledItems = items.filter((i) => Number(i.fulfilledQuantity) >= Number(i.quantity)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h3 className="text-base font-semibold text-foreground">Qué se compra</h3>
          <p className="text-xs text-muted-foreground">
            {plural(totalItems, "renglón", "renglones")} · {plural(fulfilledItems, "entregado completo", "entregados completos")}
          </p>
        </div>

        {orderStatus === "CUMPLIDA" && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <PackageCheck className="h-3.5 w-3.5" /> Se entregó todo
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px] table-auto border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                <th className="w-12 px-4 py-3 text-left text-xs font-semibold text-muted-foreground">N°</th>
                <th className="min-w-[280px] px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qué se compra</th>
                <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Cantidad</th>
                <th className="w-52 px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entregado</th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Precio unitario</th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Subtotal</th>
                {canEdit && (
                  <th className="w-32 px-4 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((item, idx) => {
                const q = Number(item.quantity);
                const f = Number(item.fulfilledQuantity);
                const progress = Math.min(100, q > 0 ? (f / q) * 100 : 0);
                const isFulfilled = f >= q && q > 0;

                return (
                  <tr key={idx} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 align-top text-xs tabular-nums text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 align-top">
                      <p className="whitespace-pre-line text-sm text-foreground">{item.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-foreground">
                      {formatNumber(q, Number.isInteger(q) ? 0 : 2)}{" "}
                      <span className="text-xs text-muted-foreground">{(item.unitOfMeasure || "unidades").toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1.5 min-w-[180px]">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className={isFulfilled ? "text-emerald-700 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}>
                            {formatNumber(f, Number.isInteger(f) ? 0 : 2)} de {formatNumber(q, Number.isInteger(q) ? 0 : 2)}
                          </span>
                          <span className={isFulfilled ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-muted-foreground"}>
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${isFulfilled ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-muted-foreground">
                      {formatPesosExactos(Number(item.unitPrice))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-semibold tabular-nums text-foreground">
                      {formatPesosExactos(Number(item.totalPrice))}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-center align-top">
                        {!isFulfilled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
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
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-foreground">
                  {formatPesosExactos(items.reduce((acc, item) => acc + Number(item.totalPrice), 0))}
                </td>
                {canEdit && <td className="px-4 py-3"></td>}
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
            unitOfMeasure: selectedItem.unitOfMeasure || "UNIDAD",
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
