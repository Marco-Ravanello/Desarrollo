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
}

export function OrderItemsTable({ orderId, orderStatus, items }: OrderItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const canEdit = orderStatus === "APROBADA" || orderStatus === "CUMPLIDA";
  const totalItems = items.length;
  const fulfilledItems = items.filter(i => Number(i.fulfilledQuantity) >= Number(i.quantity)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <ClipboardList className="h-4 w-4" />
            </div>
            <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Renglones Detallados</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{totalItems} renglones adjudicados • {fulfilledItems} completados</p>
            </div>
        </div>
        {orderStatus === "CUMPLIDA" && (
           <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-widest">
             <PackageCheck className="h-3 w-3" /> ORDEN TOTALMENTE CUMPLIDA
           </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full text-sm min-w-[900px] table-fixed">
            <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="w-[80px] text-left p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Reng.</th>
                <th className="w-[100px] text-left p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Cant.</th>
                <th className="w-[120px] text-left p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Unidad</th>
                <th className="text-left p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Descripción del Bien/Servicio</th>
                <th className="w-[180px] text-left p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Avance de Entrega</th>
                <th className="w-[140px] text-right p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">P. Unitario</th>
                <th className="w-[140px] text-right p-5 font-black text-slate-400 uppercase text-[9px] tracking-widest">Subtotal</th>
                {canEdit && <th className="w-[120px] p-5"></th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {items.map((item, idx) => {
                const q = Number(item.quantity);
                const f = Number(item.fulfilledQuantity);
                const progress = Math.min(100, (f / q) * 100);
                const isFulfilled = f >= q;

                return (
                    <tr key={idx} className="group hover:bg-slate-50/30 transition-all duration-200">
                    <td className="p-5 align-top">
                        <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                    </td>
                    <td className="p-5 align-top">
                        <span className="font-black text-slate-800 text-base leading-none">{q.toLocaleString()}</span>
                    </td>
                    <td className="p-5 align-top">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-black text-[9px] uppercase tracking-tighter px-2 py-0.5">
                        {item.unitOfMeasure || "UNIDAD"}
                        </Badge>
                    </td>
                    <td className="p-5 align-top">
                        <p className="text-slate-700 text-xs font-bold leading-relaxed">{item.description}</p>
                    </td>
                    <td className="p-5 align-top">
                        <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                            <span className={isFulfilled ? "text-emerald-600" : "text-blue-600"}>
                            {f.toLocaleString()} de {q.toLocaleString()}
                            </span>
                            <span className={isFulfilled ? "text-emerald-500" : "text-slate-400"}>{Math.round(progress)}%</span>
                        </div>
                        <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-full ${isFulfilled ? "bg-emerald-500" : "bg-blue-500"}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        </div>
                    </td>
                    <td className="p-5 text-right tabular-nums text-slate-500 font-bold align-top">
                        <span className="text-[10px] mr-1">$</span>{Number(item.unitPrice).toLocaleString()}
                    </td>
                    <td className="p-5 text-right tabular-nums font-black text-slate-900 align-top text-base leading-none">
                        <span className="text-[10px] mr-1">$</span>{Number(item.totalPrice).toLocaleString()}
                    </td>
                    {canEdit && (
                        <td className="p-5 text-right align-top">
                        {!isFulfilled ? (
                            <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm rounded-xl"
                            onClick={() => {
                                setSelectedItem(item);
                                setIsSheetOpen(true);
                            }}
                            >
                            Registrar
                            </Button>
                        ) : (
                            <div className="flex items-center justify-end gap-1.5 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50/50 py-2 px-3 rounded-xl border border-emerald-100">
                            <PackageCheck className="h-4 w-4" /> LISTO
                            </div>
                        )}
                        </td>
                    )}
                    </tr>
                );
                })}
            </tbody>
            <tfoot className="bg-slate-50/50">
                <tr>
                    <td colSpan={6} className="p-6 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Suma Total de Renglones:</td>
                    <td className="p-6 text-right font-black text-2xl text-slate-900 tabular-nums">
                        <span className="text-sm mr-1 text-slate-400 font-bold">$</span>
                        {items.reduce((acc, item) => acc + Number(item.totalPrice), 0).toLocaleString()}
                    </td>
                    {canEdit && <td className="p-6"></td>}
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
          onOpenChange={setIsSheetOpen}
          onSuccess={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
