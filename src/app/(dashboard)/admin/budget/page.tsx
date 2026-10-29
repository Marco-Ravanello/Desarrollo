export const dynamic = "force-dynamic";

import { getBudgetSummary, getUnassignedSpent } from "@/app/(dashboard)/admin/actions/budget-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, Coins, Activity, AlertTriangle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PURCHASING_VIEW_ROLES } from "@/lib/permissions";
import { BudgetEditDialog } from "@/app/(dashboard)/admin/budget/budget-edit-dialog";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatPercent, plural } from "@/lib/formato";
import { budgetState } from "@/lib/budget";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Presupuesto" };

export default async function BudgetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.role;
  // Consulta: conducción, directores de área y auditoría. Editar montos: Superadmin y Administración General.
  const canAccess = PURCHASING_VIEW_ROLES.includes(userRole);
  const canEditBudget = userRole === "SUPERADMIN" || userRole === "ADMIN_GENERAL";

  if (!canAccess) {
    redirect("/dashboard");
  }

  const [summary, unassignedSpent] = await Promise.all([getBudgetSummary(), getUnassignedSpent()]);
  const totalBudget = summary.reduce((sum, s) => sum + s.budget, 0);
  const totalSpent = summary.reduce((sum, s) => sum + s.spent, 0) + unassignedSpent;
  const remainingBudget = totalBudget - totalSpent;
  const globalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const missingBudget = summary.filter((s) => budgetState(s.budget, s.spent) === "FALTA_CARGAR").length;

  // Semáforo porcentual (sin presupuesto cargado no hay semáforo: no se puede calcular)
  let healthBadge: { label: string; color: string } | null = {
    label: "Saludable",
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  };

  if (totalBudget <= 0) {
    healthBadge = null;
  } else if (globalPercentage > 85) {
    healthBadge = {
      label: "Crítico",
      color: "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
    };
  } else if (globalPercentage > 65) {
    healthBadge = {
      label: "Moderado",
      color: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
    };
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageHeader
        title="Presupuesto"
        description="Cuánto tiene asignado cada área y cuánto lleva gastado en órdenes de compra aprobadas o cumplidas."
        icon={Wallet}
        actions={
          <Button asChild variant="outline" className="rounded-xl font-bold gap-2">
            <Link href="/admin/purchase-orders">
              <ShoppingCart className="h-4 w-4 text-primary" /> Ver órdenes de compra
            </Link>
          </Button>
        }
      />

      {/* Grid de 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Presupuesto votado"
          value={formatCurrency(totalBudget)}
          hint="Asignación total anual"
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Total ejecutado"
          value={formatCurrency(totalSpent)}
          hint={
            <>
              Órdenes aprobadas y cumplidas
              {unassignedSpent > 0 && ` (incluye ${formatCurrency(unassignedSpent)} sin área asignada)`}
            </>
          }
          icon={TrendingUp}
          tone="purple"
        />
        <StatCard
          label="Saldo disponible"
          value={totalBudget > 0 ? formatCurrency(remainingBudget) : "Sin dato"}
          hint={
            totalBudget <= 0
              ? "Falta cargar el presupuesto de las áreas"
              : remainingBudget < 0
              ? "Se ejecutó más de lo asignado"
              : "Lo que queda por ejecutar"
          }
          icon={Coins}
          tone="green"
        />
        <StatCard
          label="Ejecución promedio"
          value={
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span>{totalBudget > 0 ? formatPercent(globalPercentage) : "Sin dato"}</span>
              {healthBadge && (
                <span className={`font-sans text-xs font-bold px-2.5 py-0.5 rounded-full border ${healthBadge.color}`}>
                  {healthBadge.label}
                </span>
              )}
            </span>
          }
          hint={totalBudget > 0 ? "Tasa global de utilización" : "Todavía no se cargó el presupuesto de las áreas"}
          icon={Activity}
          tone="purple"
        />
      </div>

      {missingBudget > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {missingBudget === 1
              ? "Un área tiene órdenes aprobadas pero todavía no tiene presupuesto cargado."
              : `${plural(missingBudget, "área tiene", "áreas tienen")} órdenes aprobadas pero todavía no tienen presupuesto cargado.`}{" "}
            {canEditBudget ? "Cargalo desde la tarjeta de cada área." : "Lo carga Administración General."}
          </p>
        </div>
      )}

      {/* Termómetro de Avance Global */}
      <Card className="rounded-2xl bg-card border-border/60 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-foreground">
          <span className="text-muted-foreground">Avance del presupuesto total</span>
          <span className="tabular-nums text-primary">
            {totalBudget > 0
              ? `${formatCurrency(totalSpent)} de ${formatCurrency(totalBudget)} (${formatPercent(globalPercentage)})`
              : `${formatCurrency(totalSpent)} ejecutado · falta cargar el presupuesto`}
          </span>
        </div>
        <Progress value={Math.min(globalPercentage, 100)} className="h-3 bg-muted" />
      </Card>

      {/* Tarjetas de Áreas */}
      <div className="grid gap-6 md:grid-cols-2">
        {summary.map((area) => {
          const state = budgetState(area.budget, area.spent);
          const hasBudget = area.budget > 0;
          return (
          <Card key={area.id} className="rounded-2xl bg-card border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg font-bold text-foreground">{area.name}</CardTitle>
              {canEditBudget && hasBudget && <BudgetEditDialog areaId={area.id} areaName={area.name} currentBudget={area.budget} />}
            </CardHeader>
            <CardContent className="space-y-4">
              {hasBudget ? (
                <>
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span>Asignado: {formatCurrency(area.budget)}</span>
                    <span className={area.spent > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}>Ejecutado: {formatCurrency(area.spent)}</span>
                  </div>
                  <Progress value={Math.min(area.percentage, 100)} className="h-2.5 bg-muted" />
                  <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                    <span>{formatPercent(area.percentage)} ejecutado</span>
                    <span className={state === "EXCEDIDO" ? "font-bold text-rose-600 dark:text-rose-400" : undefined}>
                      {state === "EXCEDIDO" ? `Se pasó por ${formatCurrency(area.spent - area.budget)}` : `Restante: ${formatCurrency(area.budget - area.spent)}`}
                    </span>
                  </div>
                </>
              ) : (
                <div
                  className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    state === "FALTA_CARGAR" ? "border-amber-500/30 bg-amber-500/10" : "border-border/60 bg-muted/30"
                  }`}
                >
                  <div className="text-sm">
                    <p className={`font-bold ${state === "FALTA_CARGAR" ? "text-amber-900 dark:text-amber-200" : "text-foreground"}`}>
                      Falta cargar el presupuesto
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state === "FALTA_CARGAR"
                        ? `Ya tiene ${formatCurrency(area.spent)} en órdenes aprobadas o cumplidas.`
                        : "Todavía no tiene órdenes aprobadas."}
                    </p>
                  </div>
                  {canEditBudget && <BudgetEditDialog areaId={area.id} areaName={area.name} currentBudget={0} asButton />}
                </div>
              )}

            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
