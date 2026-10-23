import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Clock, FileEdit, CheckCircle2, Package } from "lucide-react";
import { EmptyMessage } from "@/components/ui/empty-message";
import { translateOrderStatuses } from "@/lib/purchase-orders";

/** Texto de cada movimiento: los viejos guardaban el estado con su nombre interno, y el alta solo el número. */
function logText(log: any): string {
  if (log.action === "CREATE") return "Orden cargada";
  return translateOrderStatuses(log.details || log.action);
}

export function OrderAuditTimeline({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <EmptyMessage icon={Clock} compact title="Todavía no hay movimientos en esta orden" />;

  return (
    <div className="space-y-4">
      {logs.map((log, idx) => (
        <div key={log.id} className="relative pl-6 pb-4 border-l border-border/60 last:pb-0">
          <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-border border-2 border-background" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{format(new Date(log.createdAt), "dd MMM, HH:mm", { locale: es })}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                   {log.action === 'CREATE' ? <FileEdit className="h-3 w-3" /> :
                    String(log.action).startsWith('PURCHASE_ORDER_STATUS') ? <CheckCircle2 className="h-3 w-3" /> :
                    log.action === 'UPDATE_FULFILLMENT' ? <Package className="h-3 w-3" /> :
                    <Clock className="h-3 w-3" />}
                </div>
                <p className="text-xs font-bold text-foreground">{logText(log)}</p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
                <User className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{log.user?.name || "Sistema"}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
