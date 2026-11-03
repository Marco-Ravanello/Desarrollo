export const dynamic = "force-dynamic";

import { getSupplies } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateSupplyButton } from "./create-supply-form";
import { StockList } from "./stock-list";
import Link from "next/link";
import { Package, AlertCircle, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { auth } from "@/auth";

export const metadata = { title: "Stock de insumos" };

// Los mismos roles que deja cargar y ajustar stock-actions.ts.
const STOCK_EDIT_ROLES = ["SUPERADMIN", "ADMIN_GENERAL"];

export default async function StockPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const [supplies, areas, session, params] = await Promise.all([getSupplies(), getAreas(), auth(), searchParams]);
  const canEdit = STOCK_EDIT_ROLES.includes(session?.user?.role ?? "");

  const lowStock = supplies.filter((s) => s.stock <= s.minStock);
  const lowStockCount = lowStock.length;
  // "Para reponer" abre la lista solo con esos (?ver=reponer).
  const onlyLow = params.ver === "reponer" && lowStockCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock de insumos"
        description="Qué hay en el depósito y qué hace falta reponer."
        icon={Package}
        actions={canEdit ? <CreateSupplyButton areas={areas.map((a) => ({ id: a.id, name: a.name }))} /> : undefined}
      />

      <StatRow>
        <StatCard label="Insumos" value={supplies.length} hint="Cargados en el depósito" icon={Package} tone="blue" href="/admin/stock" />
        <StatCard
          label="Para reponer"
          hint={lowStockCount > 0 ? "En el mínimo o debajo" : "Ninguno bajo el mínimo"}
          value={lowStockCount}
          icon={AlertCircle}
          tone={lowStockCount > 0 ? "red" : "slate"}
          href={lowStockCount > 0 ? "/admin/stock?ver=reponer" : undefined}
        />
      </StatRow>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
          <CardDescription>Cuánto hay de cada insumo. Los que están en el mínimo o debajo van primero.</CardDescription>
          {onlyLow && (
            <p className="pt-1">
              <Link
                href="/admin/stock"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                Solo los que hay que reponer <X className="h-3.5 w-3.5" aria-hidden /> <span className="sr-only">Ver todos</span>
              </Link>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <StockList supplies={onlyLow ? lowStock : supplies} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
