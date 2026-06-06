export const dynamic = "force-dynamic";

import { getSupplies } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateSupplyForm } from "./create-supply-form";
import { StockList } from "./stock-list";
import { Package, AlertCircle } from "lucide-react";

export default async function StockPage() {
  const [supplies, areas] = await Promise.all([
    getSupplies(),
    getAreas()
  ]);

  const lowStockCount = supplies.filter(s => s.stock <= s.minStock).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Stock</h2>
          <p className="text-muted-foreground">Control de inventario de insumos municipales y alertas de reposición.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="bg-muted border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Package className="h-5 w-5 text-blue-500" />
              {supplies.length}
            </div>
          </CardContent>
        </Card>

        <Card className={`${lowStockCount > 0 ? "bg-rose-50 dark:bg-rose-950/20" : "bg-muted"} border-none shadow-none`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Alertas de Reposición</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-2 ${lowStockCount > 0 ? "text-rose-600" : "text-foreground"}`}>
              <AlertCircle className={`h-5 w-5 ${lowStockCount > 0 ? "text-rose-600" : "text-slate-400"}`} />
              {lowStockCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateSupplyForm areas={areas} />
        </div>

        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Inventario Actual</CardTitle>
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
