export const dynamic = "force-dynamic";

import { getBudgetSummary } from "@/app/(dashboard)/admin/actions/budget-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, TrendingUp, Coins, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BudgetEditDialog } from "@/app/(dashboard)/admin/budget/budget-edit-dialog";
import Link from "next/link";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

export default async function BudgetPage() {
  const summary = await getBudgetSummary();
  const totalBudget = summary.reduce((sum, s) => sum + s.budget, 0);
  const totalSpent = summary.reduce((sum, s) => sum + s.spent, 0);
  const remainingBudget = totalBudget - totalSpent;
  const globalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Semáforo porcentual
  let healthBadge = {
    label: "Saludable",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  };

  if (globalPercentage > 85) {
    healthBadge = {
      label: "Crítico",
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20"
    };
  } else if (globalPercentage > 65) {
    healthBadge = {
      label: "Moderado",
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20"
    };
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Gestión de Presupuesto</h2>
          <p className="text-muted-foreground text-base">Monitoreo y ejecución presupuestaria de las secretarías municipales.</p>
        </div>
      </div>

      {/* Grid de 4 KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl bg-card border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Presupuesto Votado</CardTitle>
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground mt-1">Asignación total anual</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Ejecutado</CardTitle>
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground mt-1">Órdenes aprobadas y cumplidas</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Disponible Global</CardTitle>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatCurrency(remainingBudget)}</div>
            <p className="text-xs text-muted-foreground mt-1">Fondo remanente</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ejecución Promedio</CardTitle>
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{globalPercentage.toFixed(1)}%</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${healthBadge.color}`}>
                {healthBadge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tasa global de utilización</p>
          </CardContent>
        </Card>
      </div>

      {/* Termómetro de Avance Global */}
      <Card className="rounded-3xl bg-card border-border/60 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-foreground">
          <span className="uppercase tracking-wider text-muted-foreground">Avance Presupuestario Global</span>
          <span className="font-mono text-primary">{formatCurrency(totalSpent)} de {formatCurrency(totalBudget)} ({globalPercentage.toFixed(1)}%)</span>
        </div>
        <Progress value={Math.min(globalPercentage, 100)} className="h-3 bg-muted" />
      </Card>

      {/* Tarjetas de Áreas */}
      <div className="grid gap-6 md:grid-cols-2">
        {summary.map((area) => (
          <Card key={area.id} className="rounded-3xl bg-card border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{area.name}</CardTitle>
                <CardDescription>Presupuesto Anual de la Secretaría</CardDescription>
              </div>
              <BudgetEditDialog areaId={area.id} areaName={area.name} currentBudget={area.budget} />
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between text-xs font-bold text-foreground">
                  <span>Asignado: {formatCurrency(area.budget)}</span>
                  <span className="text-rose-600 dark:text-rose-400">Ejecutado: {formatCurrency(area.spent)}</span>
               </div>
               <Progress
                  value={Math.min(area.percentage, 100)}
                  className="h-2.5 bg-muted"
               />
               <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                 <span>{area.percentage.toFixed(1)}% ejecutado</span>
                 <span>Restante: {formatCurrency(area.budget - area.spent)}</span>
               </div>

               <div className="pt-3 border-t border-border/40 flex justify-end">
                 <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-xs h-8 gap-1.5 font-bold hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors"
                 >
                    <Link href={`/admin/agreements?areaId=${area.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Convenios del Área
                    </Link>
                 </Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
