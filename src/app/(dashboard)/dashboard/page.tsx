export const dynamic = "force-dynamic";
import { getDashboardStats } from "@/services/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, ArrowRightLeft, ShoppingBag, Receipt, TrendingUp, Activity, User, Calendar, Car, CheckCircle2, ShieldAlert } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const mainCards = [
    { title: "Familias Registradas", description: "Total en base de datos", value: stats.peopleCount, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", trend: "+2% este mes" },
    { title: "Casos Activos", description: "Abiertos o en proceso", value: stats.activeCases, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", trend: "8 resueltos hoy" },
    { title: "Tareas Pendientes", description: "Asignadas para hoy", value: stats.todayTasks, icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", trend: "Prioridad alta" },
    { title: "Casos Críticos", description: "Urgencia máxima", value: stats.criticalCases, icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", trend: "Requiere atención" },
  ];

  const adminCards = [
    { title: "OC Pendientes", value: stats.pendingPurchaseOrders, icon: ShoppingBag, color: "text-slate-600" },
    { title: "Derivaciones", value: stats.pendingDerivations, icon: ArrowRightLeft, color: "text-slate-600" },
    { title: "Vehículos Libres", value: `${stats.vehicleStats.available}/${stats.vehicleStats.total}`, icon: Car, color: "text-slate-600" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-black tracking-tight text-foreground">Panel de Control</h2>
          <p className="text-muted-foreground text-lg">Resumen estratégico de la gestión municipal.</p>
        </div>
        <ExecutiveReportButton />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mainCards.map((card) => (
          <Card key={card.title} className="border-none shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{card.title}</CardTitle>
              </div>
              <div className={`p-3 rounded-2xl ${card.bg} group-hover:scale-110 transition-transform duration-500`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-black text-foreground mb-1 tracking-tighter">{card.value}</div>
              <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
                {card.trend}
              </div>
            </CardContent>
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`}>
               <card.icon className="w-full h-full" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {adminCards.map((card) => (
           <div key={card.title} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm">
              <div className="p-2 rounded-xl bg-muted">
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.title}</p>
                <p className="text-xl font-bold">{card.value}</p>
              </div>
           </div>
        ))}
      </div>

      <DashboardCharts
        casesByAreaData={stats.casesByAreaData}
        poStatusData={stats.poStatusData}
        trendData={stats.trends}
      />

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
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-sm text-foreground">{log.user.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.entity} #{log.entityId.substring(0, 8)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
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
