export const dynamic = "force-dynamic";
import { getDashboardStats } from "@/services/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users, FileText, ShoppingBag, ArrowRightLeft, Car,
  CheckCircle2, ShieldAlert, Activity, Clock
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MiniHeatmapWidget } from "@/components/dashboard/mini-heatmap-widget";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getActionBadge(action: string) {
  switch (action) {
    case "CREATE":
      return <Badge className="text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-md px-2 py-0.5">{action}</Badge>;
    case "UPDATE":
    case "UPDATE_STATUS":
      return <Badge className="text-[10px] font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-md px-2 py-0.5">{action}</Badge>;
    case "DELETE":
      return <Badge className="text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md px-2 py-0.5">{action}</Badge>;
    case "LOGIN":
      return <Badge className="text-[10px] font-bold uppercase bg-slate-500/15 text-slate-400 border border-slate-500/25 rounded-md px-2 py-0.5">{action}</Badge>;
    default:
      return <Badge className="text-[10px] font-bold uppercase bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded-md px-2 py-0.5">{action}</Badge>;
  }
}

function getRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const greeting = getGreeting();

  const mainCards = [
    {
      title: "Familias Registradas",
      value: stats.peopleCount,
      icon: Users,
      color: "text-blue-400",
      iconBg: "bg-blue-500/15 ring-1 ring-blue-500/20",
      trend: "+2% este mes",
      trendColor: "text-emerald-400",
    },
    {
      title: "Casos Activos",
      value: stats.activeCases,
      icon: FileText,
      color: "text-emerald-400",
      iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/20",
      trend: "Abiertos o en proceso",
      trendColor: "text-slate-400",
    },
    {
      title: "Tareas Pendientes",
      value: stats.todayTasks,
      icon: CheckCircle2,
      color: "text-amber-400",
      iconBg: "bg-amber-500/15 ring-1 ring-amber-500/20",
      trend: "Prioridad alta",
      trendColor: "text-amber-400",
    },
    {
      title: "Alertas Críticas",
      value: stats.criticalCases,
      icon: ShieldAlert,
      color: "text-rose-400",
      iconBg: "bg-rose-500/15 ring-1 ring-rose-500/20",
      trend: stats.criticalCases > 0 ? "Requieren atención" : "Sin alertas activas",
      trendColor: stats.criticalCases > 0 ? "text-rose-400" : "text-emerald-400",
    },
  ];

  const adminCards = [
    { title: "OC Pendientes", value: stats.pendingPurchaseOrders, icon: ShoppingBag, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { title: "Derivaciones", value: stats.pendingDerivations, icon: ArrowRightLeft, color: "text-sky-400", bg: "bg-sky-500/10" },
    { title: "Vehículos Libres", value: `${stats.vehicleStats.available}/${stats.vehicleStats.total}`, icon: Car, color: "text-teal-400", bg: "bg-teal-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{greeting}</p>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Panel de Control</h2>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Resumen estratégico de la gestión municipal.
            {stats.criticalCases > 0 && (
              <span className="ml-2 text-rose-400 font-semibold">
                {stats.criticalCases} {stats.criticalCases === 1 ? "alerta crítica activa" : "alertas críticas activas"}.
              </span>
            )}
          </p>
        </div>
        <ExecutiveReportButton />
      </div>

      {/* Main KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mainCards.map((card) => (
          <Card
            key={card.title}
            className="border border-white/[0.06] shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden bg-card/60 backdrop-blur-md relative"
          >
            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0 relative z-10">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">
                {card.title}
              </CardTitle>
              <div className={`p-2.5 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pb-4">
              <div className="text-4xl font-black text-foreground mb-2 tracking-tighter">
                {card.value}
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${card.trendColor}`}>
                <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                {card.trend}
              </div>
            </CardContent>
            {/* Ghost icon */}
            <div className="absolute -right-3 -bottom-3 w-20 h-20 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500 pointer-events-none">
              <card.icon className="w-full h-full" />
            </div>
          </Card>
        ))}
      </div>

      {/* Admin Status Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {adminCards.map((card) => (
          <div
            key={card.title}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/50 backdrop-blur-sm border border-white/[0.06] shadow-md hover:border-white/[0.1] transition-all duration-200"
          >
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.title}</p>
              <p className="text-lg font-black text-foreground leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <DashboardCharts
        casesByAreaData={stats.casesByAreaData}
        poStatusData={stats.poStatusData}
        trendData={stats.trends}
      />

      {/* Bottom Section: Heatmap Widget & Recent Activity Feed */}
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-5 lg:col-span-4">
          <MiniHeatmapWidget />
        </div>
        <div className="md:col-span-7 lg:col-span-8">
          <Card className="bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-xl h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground">Actividad Reciente</CardTitle>
                <CardDescription className="text-xs">Últimas acciones realizadas en la plataforma.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {stats.recentActivity.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cuándo</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Usuario</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acción</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentActivity.map((log) => (
                      <TableRow key={log.id} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {getRelativeTime(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-white">{log.user.name?.[0] || "U"}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                              {log.user.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {log.entity} <span className="text-slate-600">#{log.entityId.substring(0, 6)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
                  <Activity className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hay actividad registrada aún.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
