export const dynamic = "force-dynamic";

import { getSupplies } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateSupplyForm } from "./create-supply-form";
import { StockList } from "./stock-list";
import { Package, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Stock de insumos" };

export default async function StockPage() {
  const [supplies, areas] = await Promise.all([
    getSupplies(),
    getAreas()
  ]);

  const lowStockCount = supplies.filter(s => s.stock <= s.minStock).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock de insumos"
        description="Qué hay en el depósito y qué hace falta reponer."
        icon={Package}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total items" value={supplies.length} icon={Package} tone="blue" />
        <StatCard
          label="Alertas de reposición"
          value={<span className={lowStockCount > 0 ? "text-rose-600" : undefined}>{lowStockCount}</span>}
          icon={AlertCircle}
          tone={lowStockCount > 0 ? "red" : "slate"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateSupplyForm areas={areas} />
        </div>

        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Inventario actual</CardTitle>
            <CardDescription>Lista de insumos registrados y niveles de stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <StockList supplies={supplies} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
