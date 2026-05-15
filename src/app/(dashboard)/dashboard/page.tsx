export const dynamic = "force-dynamic";
import { getDashboardStats } from "@/services/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ArrowRightLeft, ShoppingBag, Receipt, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const cards = [
    { title: "Ciudadanos", value: stats.peopleCount, icon: Users, color: "text-blue-600" },
    { title: "Casos Activos", value: stats.activeCases, icon: FileText, color: "text-orange-600" },
    { title: "Derivaciones", value: stats.pendingDerivations, icon: ArrowRightLeft, color: "text-purple-600" },
    { title: "OC Pendientes", value: stats.pendingPurchaseOrders, icon: ShoppingBag, color: "text-green-600" },
    { title: "Facturas", value: stats.pendingInvoices, icon: Receipt, color: "text-yellow-600" },
    { title: "Stock Crítico", value: stats.lowStockItems, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold">Panel de Control</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
