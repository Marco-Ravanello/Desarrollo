export const dynamic = "force-dynamic";

import { getSupplies } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateSupplyButton } from "./create-supply-form";
import { StockList } from "./stock-list";
import { Package, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { auth } from "@/auth";

export const metadata = { title: "Stock de insumos" };

// Los mismos roles que deja cargar y ajustar stock-actions.ts.
const STOCK_EDIT_ROLES = ["SUPERADMIN", "ADMIN_GENERAL"];

export default async function StockPage() {
  const [supplies, areas, session] = await Promise.all([getSupplies(), getAreas(), auth()]);
  const canEdit = STOCK_EDIT_ROLES.includes(session?.user?.role ?? "");

  const lowStockCount = supplies.filter((s) => s.stock <= s.minStock).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock de insumos"
        description="Qué hay en el depósito y qué hace falta reponer."
        icon={Package}
        actions={canEdit ? <CreateSupplyButton areas={areas.map((a) => ({ id: a.id, name: a.name }))} /> : undefined}
      />

      <StatRow>
        <StatCard label="Insumos" value={supplies.length} hint="Cargados en el depósito" icon={Package} tone="blue" />
        <StatCard
          label="Para reponer"
          hint={lowStockCount > 0 ? "En el mínimo o debajo" : "Ninguno bajo el mínimo"}
          value={lowStockCount}
          icon={AlertCircle}
          tone={lowStockCount > 0 ? "red" : "slate"}
        />
      </StatRow>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
          <CardDescription>Cuánto hay de cada insumo. Los que están en el mínimo o debajo van primero.</CardDescription>
        </CardHeader>
        <CardContent>
          <StockList supplies={supplies} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
