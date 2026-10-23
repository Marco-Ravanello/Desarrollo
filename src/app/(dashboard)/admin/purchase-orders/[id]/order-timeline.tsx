import { CheckCircle2, FileText, Send, Truck, PackageCheck, X, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type StageState = "completed" | "current" | "pending" | "stopped";

interface Stage {
  id: string;
  name: string;
  icon: React.ElementType;
  state: StageState;
  note?: string;
}

/**
 * Los pasos reales de la orden en la app: borrador, a la firma, aprobada, entregas y cumplida.
 * Los pagos no se registran en la app, así que no aparecen como pasos.
 */
export function OrderTimeline({ currentStatus, deliveredPct }: { currentStatus: string; deliveredPct: number }) {
  const order = ["BORRADOR", "PENDIENTE_APROBACION", "APROBADA", "CUMPLIDA"];
  const reached = order.indexOf(currentStatus);
  const pct = Math.round(deliveredPct);

  const stages: Stage[] = [
    { id: "borrador", name: "Borrador", icon: FileText, state: reached > 0 ? "completed" : "current" },
    { id: "firma", name: "A la firma", icon: Send, state: reached > 1 ? "completed" : reached === 1 ? "current" : "pending" },
    { id: "aprobada", name: "Aprobada", icon: CheckCircle2, state: reached >= 2 ? "completed" : "pending" },
    {
      id: "entregas",
      name: "Entregas",
      icon: Truck,
      state: reached === 3 ? "completed" : reached === 2 ? "current" : "pending",
      note: reached >= 2 ? `${pct} % entregado` : undefined,
    },
    { id: "cumplida", name: "Cumplida", icon: PackageCheck, state: reached === 3 ? "completed" : "pending" },
  ];

  // Rechazada: se cortó en la firma. Cancelada: se corta en el paso donde estaba (no se sabe cuál), se muestra al final.
  if (currentStatus === "RECHAZADA") {
    stages[0].state = "completed";
    stages[1] = { ...stages[1], name: "Rechazada", icon: X, state: "stopped", note: "Vuelve a borrador para corregirla" };
  } else if (currentStatus === "CANCELADA") {
    stages.forEach((s) => (s.state = "pending"));
    stages[0].state = "completed";
    stages[4] = { ...stages[4], name: "Cancelada", icon: Ban, state: "stopped" };
  }

  const done = stages.filter((s) => s.state === "completed").length;
  return (
    <div className="w-full py-6 px-4 overflow-x-auto">
      <div className="relative flex justify-between min-w-[420px]">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-0"
          style={{ width: `${(Math.max(done, 1) - 1) / (stages.length - 1) * 100}%` }}
        />

        {stages.map((stage) => (
          <div key={stage.id} className="relative z-10 flex flex-col items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-4 border-background shadow-sm",
                stage.state === "completed" ? "bg-primary text-primary-foreground" :
                stage.state === "current" ? "bg-background text-primary border-primary" :
                stage.state === "stopped" ? "bg-rose-600 text-white" :
                "bg-muted text-muted-foreground"
              )}
            >
              <stage.icon className="h-5 w-5" />
            </div>
            <div className="mt-2 text-center">
              <p
                className={cn(
                  "text-xs font-bold",
                  stage.state === "stopped" ? "text-rose-700 dark:text-rose-400" :
                  stage.state === "pending" ? "text-muted-foreground" : "text-primary"
                )}
              >
                {stage.name}
              </p>
              {stage.state === "current" && !stage.note && <span className="text-xs font-semibold text-primary/80">Ahora</span>}
              {stage.note && <span className="block text-xs text-muted-foreground max-w-[9rem]">{stage.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
