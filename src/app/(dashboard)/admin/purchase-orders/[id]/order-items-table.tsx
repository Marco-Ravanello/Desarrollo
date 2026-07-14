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
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Ejecución</th>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Unitario</th>
              <th className="text-left p-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Total</th>
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
                    <td className="p-4">
                      {!isFulfilled ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsSheetOpen(true);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <PackageCheck className="h-5 w-5 text-green-500 mx-auto" />
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
