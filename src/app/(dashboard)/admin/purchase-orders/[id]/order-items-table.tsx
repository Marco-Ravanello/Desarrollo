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

      <div className="border rounded-2xl overflow-x-auto bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-sm min-w-[800px] table-fixed">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="w-[60px] text-left p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Cant.</th>
              <th className="w-[80px] text-left p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Unidad</th>
              <th className="text-left p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Descripción</th>
              <th className="w-[140px] text-left p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Ejecución</th>
              <th className="w-[110px] text-right p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Unitario</th>
              <th className="w-[120px] text-right p-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest">Total</th>
              {canEdit && <th className="w-[100px] p-4"></th>}
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
                  <td className="p-4 align-top">
                    <span className="font-black text-slate-700">{q.toLocaleString()}</span>
                  </td>
                  <td className="p-4 align-top">
                    <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 uppercase inline-block whitespace-nowrap">
                      {item.unitOfMeasure || "UNID"}
                    </span>
                  </td>
                  <td className="p-4 align-top">
                    <p className="text-slate-700 text-xs font-medium leading-relaxed">{item.description}</p>
                  </td>
                  <td className="p-4 align-top">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black">
                        <span className={isFulfilled ? "text-green-600" : "text-blue-600"}>
                          {f.toLocaleString()} / {q.toLocaleString()}
                        </span>
                        <span className="text-slate-400">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className={`h-1.5 ${isFulfilled ? "[&>div]:bg-green-500" : "[&>div]:bg-blue-500"} bg-slate-100`} />
                    </div>
                  </td>
                  <td className="p-4 text-right tabular-nums text-slate-500 font-medium align-top">
                    ${Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="p-4 text-right tabular-nums font-black text-slate-900 align-top">
                    ${Number(item.totalPrice).toLocaleString()}
                  </td>
                  {canEdit && (
                    <td className="p-4 text-right align-top">
                      {!isFulfilled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsSheetOpen(true);
                          }}
                        >
                          Registrar
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 text-green-600 font-black text-[9px] uppercase">
                           <PackageCheck className="h-4 w-4" /> Listo
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
