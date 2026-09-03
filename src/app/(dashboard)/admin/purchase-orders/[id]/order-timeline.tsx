import { CheckCircle2, FileText, ShoppingCart, Landmark, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  icon: any;
  status: 'completed' | 'current' | 'pending';
}

export function OrderTimeline({ currentStatus }: { currentStatus: string }) {
  // Mapping currentStatus to stages
  // Stage Flow: Creación → Compras → Secretaría → Tesorería → Pago

  const stages: Stage[] = [
    { id: 'creation', name: 'Creación', icon: FileText, status: 'completed' },
    { id: 'compras', name: 'Compras', icon: ShoppingCart, status: currentStatus !== 'BORRADOR' ? 'completed' : 'pending' },
    { id: 'secretaria', name: 'Secretaría', icon: CheckCircle2, status: (currentStatus === 'APROBADA' || currentStatus === 'CUMPLIDA') ? 'completed' : (currentStatus === 'PENDIENTE_APROBACION' ? 'current' : 'pending') },
    { id: 'tesoreria', name: 'Tesorería', icon: Landmark, status: currentStatus === 'CUMPLIDA' ? 'completed' : (currentStatus === 'APROBADA' ? 'current' : 'pending') },
    { id: 'pago', name: 'Pago', icon: CreditCard, status: currentStatus === 'CUMPLIDA' ? 'completed' : 'pending' },
  ];

  return (
    <div className="w-full py-6 px-4">
      <div className="relative flex justify-between">
        {/* Connection Line */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-0"
          style={{ width: `${(stages.filter(s => s.status === 'completed').length - 1) / (stages.length - 1) * 100}%` }}
        />

        {stages.map((stage) => (
          <div key={stage.id} className="relative z-10 flex flex-col items-center group">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-4 border-background shadow-sm transition-all",
              stage.status === 'completed' ? "bg-primary text-primary-foreground" :
              stage.status === 'current' ? "bg-background text-primary border-primary animate-pulse" :
              "bg-muted text-muted-foreground"
            )}>
              <stage.icon className="h-5 w-5" />
            </div>
            <div className="mt-2 text-center">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                stage.status === 'completed' ? "text-primary" :
                stage.status === 'current' ? "text-primary" :
                "text-muted-foreground"
              )}>
                {stage.name}
              </p>
              {stage.status === 'current' && (
                 <span className="text-[8px] font-bold text-primary/80 uppercase animate-pulse">En proceso</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
