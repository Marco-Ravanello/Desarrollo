import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Clock, FileEdit, CheckCircle2, Package } from "lucide-react";

export function OrderAuditTimeline({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <p className="text-xs text-slate-400">Sin actividad registrada.</p>;

  return (
    <div className="space-y-4">
      {logs.map((log, idx) => (
        <div key={log.id} className="relative pl-6 pb-4 border-l border-slate-100 last:pb-0">
          <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">{format(new Date(log.createdAt), "dd MMM, HH:mm", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                   {log.action === 'CREATE' ? <FileEdit className="h-3 w-3" /> :
                    log.action === 'UPDATE_STATUS' ? <CheckCircle2 className="h-3 w-3" /> :
                    log.action === 'UPDATE_FULFILLMENT' ? <Package className="h-3 w-3" /> :
                    <Clock className="h-3 w-3" />}
                </div>
                <p className="text-xs font-bold text-slate-700">{log.details || log.action}</p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
                <User className="h-2.5 w-2.5 text-slate-400" />
                <span className="text-[9px] font-medium text-slate-500">{log.user?.name || "Sistema"}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
