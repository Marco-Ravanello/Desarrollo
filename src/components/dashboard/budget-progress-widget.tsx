"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface BudgetProgressWidgetProps {
  executedAmount?: number;
  totalBudget?: number;
}

export function BudgetProgressWidget({
  executedAmount = 0,
  totalBudget = 20000000
}: BudgetProgressWidgetProps) {
  const percentage = Math.min(100, Math.round((executedAmount / totalBudget) * 100));

  let colorStyle = {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    statusText: "Ejecución Presupuestaria Saludable",
    icon: CheckCircle2
  };

  if (percentage >= 85) {
    colorStyle = {
      bar: "bg-rose-500",
      text: "text-rose-400",
      border: "border-rose-500/20",
      bg: "bg-rose-500/10",
      badge: "bg-rose-500/15 text-rose-400 border-rose-500/25",
      statusText: "Atención: Límite Presupuestario Crítico",
      icon: AlertTriangle
    };
  } else if (percentage >= 70) {
    colorStyle = {
      bar: "bg-amber-500",
      text: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/10",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      statusText: "Ejecución Presupuestaria Moderada",
      icon: TrendingUp
    };
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(val);
  };

  const StatusIcon = colorStyle.icon;

  return (
    <Card className="bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${colorStyle.bg} border ${colorStyle.border}`}>
            <DollarSign className={`h-4 w-4 ${colorStyle.text}`} />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Termómetro Presupuestario</CardTitle>
            <CardDescription className="text-xs">Ejecución acumulada de fondos aprobados ($ ARS).</CardDescription>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${colorStyle.badge}`}>
          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{percentage}% Ejecutado</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Ejecutado</span>
            <span className="text-2xl font-black text-foreground tracking-tight">
              {formatCurrency(executedAmount)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Presupuesto Anual</span>
            <span className="text-sm font-semibold text-muted-foreground">
              {formatCurrency(totalBudget)}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
            <div
              className={`h-full rounded-full transition-all duration-1000 shadow-md ${colorStyle.bar}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
            <span>0%</span>
            <span className={colorStyle.text}>{colorStyle.statusText}</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
