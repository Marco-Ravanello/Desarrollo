"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PackageCheck, ChevronRight } from "lucide-react";
import { RecordFulfillmentSheet } from "./record-fulfillment-sheet";

interface OrderItemsTableProps {
  orderId: string;
  orderStatus: string;
  items: any[];
}

export function OrderItemsTable({ orderId, orderStatus, items }: OrderItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const canEdit = orderStatus === "APROBADA" || orderStatus === "CUMPLIDA";

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Renglones Detallados y Ejecución</label>
        {orderStatus === "CUMPLIDA" && (
           <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
             <PackageCheck className="h-3 w-3" /> ORDEN TOTALMENTE CUMPLIDA
           </div>
        )}
      </div>

      <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Cant.</th>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Unidad</th>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest w-full">Descripción</th>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Ejecución</th>
              <th className="text-right p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Unitario</th>
              <th className="text-right p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Total</th>
              {canEdit && <th className="p-4"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const q = Number(item.quantity);
              const f = Number(item.fulfilledQuantity);
              const progress = Math.min(100, (f / q) * 100);
              const isFulfilled = f >= q;

              return (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <span className="font-black text-slate-700">{q.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{item.unitOfMeasure || "UNID"}</span>
                  </td>
                  <td className="p-4">
                    <p className="text-slate-800 font-medium leading-tight">{item.description}</p>
                  </td>
                  <td className="p-4 min-w-[140px]">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className={isFulfilled ? "text-green-600" : "text-blue-600"}>
                          {f.toLocaleString()} / {q.toLocaleString()}
                        </span>
                        <span className="text-slate-400">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className={`h-1.5 ${isFulfilled ? "[&>div]:bg-green-500" : "[&>div]:bg-blue-500"}`} />
                    </div>
                  </td>
                  <td className="p-4 text-right tabular-nums text-slate-500">
                    ${Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="p-4 text-right tabular-nums font-black text-slate-900">
                    ${Number(item.totalPrice).toLocaleString()}
                  </td>
                  {canEdit && (
                    <td className="p-4 text-right">
                      {!isFulfilled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsSheetOpen(true);
                          }}
                        >
                          Registrar
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 text-green-600 font-bold text-[10px] uppercase">
                           <PackageCheck className="h-4 w-4" /> Completo
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
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
          onOpenChange={setIsSheetOpen}
          onSuccess={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
