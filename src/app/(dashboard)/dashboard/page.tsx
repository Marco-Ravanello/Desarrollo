export const dynamic = "force-dynamic";
import { getDashboardStats } from "@/services/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, ArrowRightLeft, ShoppingBag, Receipt, AlertTriangle, TrendingUp, Activity, User, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const cards = [
    { title: "Ciudadanos", description: "Total de personas registradas", value: stats.peopleCount, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Casos Activos", description: "En proceso o abiertos", value: stats.activeCases, icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "Derivaciones", description: "Pendientes entre áreas", value: stats.pendingDerivations, icon: ArrowRightLeft, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "OC Pendientes", description: "Órdenes por aprobar", value: stats.pendingPurchaseOrders, icon: ShoppingBag, color: "text-green-600", bg: "bg-green-50" },
    { title: "Facturas", description: "Pendientes de pago", value: stats.pendingInvoices, icon: Receipt, color: "text-yellow-600", bg: "bg-yellow-50" },
    { title: "Stock Crítico", description: "Insumos sin existencia", value: stats.lowStockItems, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Panel de Control</h2>
        <p className="text-slate-500">Resumen general de indicadores por área.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{card.title}</CardTitle>
                <CardDescription className="text-xs">{card.description}</CardDescription>
              </div>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{card.value}</div>
              <div className="mt-4 flex items-center text-xs text-slate-500">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                <span>Actualizado ahora mismo</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-1">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <div className="space-y-1">
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas acciones realizadas en la plataforma.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentActivity.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-sm">{log.user.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {log.entity} #{log.entityId.substring(0, 8)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Calendar className="h-10 w-10 mb-2 opacity-20" />
                <p>No hay actividad registrada aún.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
