export const dynamic = "force-dynamic";

import { getBudgetSummary } from "@/app/(dashboard)/admin/actions/budget-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { BudgetEditDialog } from "@/app/(dashboard)/admin/budget/budget-edit-dialog";

export default async function BudgetPage() {
  const summary = await getBudgetSummary();
  const totalBudget = summary.reduce((sum, s) => sum + s.budget, 0);
  const totalSpent = summary.reduce((sum, s) => sum + s.spent, 0);
  const globalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Gestión de Presupuesto</h2>
          <p className="text-muted-foreground">Monitoreo de ejecución presupuestaria por secretaría.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Ejecución Total</p>
          <p className="text-2xl font-bold text-blue-600">${totalSpent.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">de ${totalBudget.toLocaleString('es-AR')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-slate-900 dark:bg-slate-800 text-white border-none shadow-lg shadow-blue-900/10">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-slate-400">Disponible Global</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalBudget - totalSpent).toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {summary.map((area) => (
          <Card key={area.id} className="overflow-hidden border-none shadow-sm bg-card hover:shadow-md transition-all">
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg text-foreground">{area.name}</CardTitle>
                <CardDescription>Presupuesto Anual</CardDescription>
              </div>
              <BudgetEditDialog areaId={area.id} areaName={area.name} currentBudget={area.budget} />
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between text-xs font-bold text-foreground">
                  <span>Asignado: ${area.budget.toLocaleString()}</span>
                  <span className="text-rose-600 dark:text-rose-400">Ejecutado: ${area.spent.toLocaleString()}</span>
               </div>
               <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${area.percentage > 90 ? 'bg-rose-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(area.percentage, 100)}%` }}
                  />
               </div>
               <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                 <span>{area.percentage.toFixed(1)}% ejecutado</span>
                 <span>Restante: ${(area.budget - area.spent).toLocaleString()}</span>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
