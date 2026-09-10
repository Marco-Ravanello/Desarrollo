"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Building2,
  PieChart,
  Zap,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";

interface BudgetProgressWidgetProps {
  executedAmount?: number;
  totalBudget?: number;
  areas?: any[];
}

export function BudgetProgressWidget({
  executedAmount = 14850000,
  totalBudget = 60000000,
  areas = []
}: BudgetProgressWidgetProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const effectiveBudget = totalBudget > 0 ? totalBudget : 60000000;
  const remainingBudget = Math.max(0, effectiveBudget - executedAmount);
  const percentage = Math.min(100, Math.round((executedAmount / effectiveBudget) * 100));

  // Compute burn rate (ritmo de gasto proyectado mensual o consumo diario)
  const daysInYear = 365;
  const currentDayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24
  );
  const expectedPercentage = Math.round((currentDayOfYear / daysInYear) * 100);
  const burnRateStatus =
    percentage > expectedPercentage + 10
      ? "Acelerado"
      : percentage < expectedPercentage - 10
      ? "Moderado"
      : "Sincronizado";

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
      statusText: "Límite Presupuestario Crítico",
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

  // Compute area metrics if not supplied or empty
  const defaultAreaAllocations = areas.length > 0
    ? areas
    : [
        { name: "Desarrollo Social & Hábitat", annualBudget: 22000000, executedBudget: 6200000 },
        { name: "Niñez, Adolescencia y Familia", annualBudget: 15000000, executedBudget: 3800000 },
        { name: "Asistencia contra Violencia de Género", annualBudget: 12000000, executedBudget: 2900000 },
        { name: "Coordinación Operativa & Logística", annualBudget: 11000000, executedBudget: 1950000 }
      ];

  return (
    <Card className="bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-xl overflow-hidden transition-all duration-300">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${colorStyle.bg} border ${colorStyle.border}`}>
            <DollarSign className={`h-5 w-5 ${colorStyle.text}`} />
          </div>
          <div>
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              Termómetro Presupuestario Municipal 3F
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Ejecución acumulada de fondos aprobados y balance por partidas operativas.
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${colorStyle.badge}`}>
            <StatusIcon className="h-4 w-4 shrink-0" />
            <span>{percentage}% Ejecutado</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
          >
            <span>{isExpanded ? "Ocultar Desglose" : "Ver Desglose por Áreas"}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-3">
        {/* 4 Key Financial Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Total Ejecutado
            </span>
            <span className="text-lg font-black text-foreground tracking-tight font-mono">
              {formatCurrency(executedAmount)}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
              {percentage}% del presupuesto
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Saldo Remanente
            </span>
            <span className="text-lg font-black text-emerald-400 tracking-tight font-mono">
              {formatCurrency(remainingBudget)}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Disponible global
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Presupuesto Anual
            </span>
            <span className="text-lg font-black text-foreground tracking-tight font-mono">
              {formatCurrency(effectiveBudget)}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Votado por Ordenanza
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Ritmo de Gasto
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base font-black text-foreground">{burnRateStatus}</span>
              <Badge className="text-[9px] font-bold uppercase bg-primary/20 text-primary border-none px-1.5 py-0">
                {expectedPercentage}% esp.
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Proyección al día {currentDayOfYear}
            </span>
          </div>
        </div>

        {/* Multi-stop Thermometer Progress Bar */}
        <div className="space-y-2">
          <div className="relative h-4 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-white/[0.08] shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 shadow-md ${colorStyle.bar}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Multi-stop Ticks (0%, 25%, 50%, 75%, 100%) */}
          <div className="relative flex justify-between items-center text-[10px] font-mono font-bold text-muted-foreground px-0.5">
            <div className="flex flex-col items-start">
              <span>0%</span>
              <span className="text-[9px] font-normal opacity-75">$0</span>
            </div>
            <div className="flex flex-col items-center">
              <span>25%</span>
              <span className="text-[9px] font-normal opacity-75">{formatCurrency(effectiveBudget * 0.25)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span>50%</span>
              <span className="text-[9px] font-normal opacity-75">{formatCurrency(effectiveBudget * 0.50)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span>75%</span>
              <span className="text-[9px] font-normal opacity-75">{formatCurrency(effectiveBudget * 0.75)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span>100%</span>
              <span className="text-[9px] font-normal opacity-75">{formatCurrency(effectiveBudget)}</span>
            </div>
          </div>
        </div>

        {/* Expandable Drawer: Partidas y Ejecución por Dependencia */}
        {isExpanded && (
          <div className="pt-4 border-t border-border/40 space-y-4 animate-in slide-in-from-top-3 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Ejecución por Dependencia Municipal
                </h4>
              </div>

              <Link href="/admin/budget">
                <Button size="sm" className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm">
                  Administración de Partidas <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {defaultAreaAllocations.map((a: any, idx: number) => {
                const areaAnnual = Number(a.annualBudget || 0);
                const areaExecuted = Number(a.executedBudget || 0);
                const areaPercent = areaAnnual > 0 ? Math.min(100, Math.round((areaExecuted / areaAnnual) * 100)) : 0;

                return (
                  <div key={a.name || idx} className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-foreground truncate max-w-[200px]">{a.name}</span>
                      <span className="font-mono text-emerald-400">{areaPercent}%</span>
                    </div>

                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${areaPercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>Ejecutado: {formatCurrency(areaExecuted)}</span>
                      <span>Partida: {formatCurrency(areaAnnual)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
