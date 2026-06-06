export const dynamic = "force-dynamic";
import { getBudgetSummary } from "@/app/(dashboard)/admin/actions/budget-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Wallet, TrendingDown, AlertCircle } from "lucide-react";
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
          <h2 className="text-3xl font-bold">Gestión de Presupuesto</h2>
          <p className="text-slate-500">Monitoreo de ejecución presupuestaria por secretaría.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">Ejecución Total</p>
          <p className="text-2xl font-bold text-blue-600">${totalSpent.toLocaleString('es-AR')}</p>
          <p className="text-xs text-slate-400">de ${totalBudget.toLocaleString('es-AR')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-slate-900 text-white border-none">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-slate-400">Disponible Global</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalBudget - totalSpent).toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {summary.map((area) => (
          <Card key={area.id} className="overflow-hidden border-none shadow-sm bg-background">
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">{area.name}</CardTitle>
                <CardDescription>Presupuesto Anual</CardDescription>
              </div>
              <BudgetEditDialog areaId={area.id} areaName={area.name} currentBudget={area.budget} />
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between text-xs font-bold">
                  <span>Asignado: ${area.budget.toLocaleString()}</span>
                  <span className="text-rose-600">Ejecutado: ${area.spent.toLocaleString()}</span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(area.percentage, 100)}%` }} />
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
