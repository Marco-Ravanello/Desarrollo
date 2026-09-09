export const dynamic = "force-dynamic";

import { getTasks } from "@/services/system";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TaskList } from "./task-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Clock, Calendar, AlertTriangle, ClipboardCheck, ArrowRight
} from "lucide-react";
import Link from "next/link";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tasks = await getTasks(session.user.id);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETADA").length;
  const pendingTasks = tasks.filter((t) => t.status !== "COMPLETADA");
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const urgentOrOverdue = pendingTasks.filter((t) => {
    const isUrgent = (t as any).priority === "URGENTE";
    const isOverdue = t.dueDate ? new Date(t.dueDate) < now : false;
    return isUrgent || isOverdue;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Mis Tareas & Pendientes
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                  Productividad Municipal
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Panel de gestión personal de compromisos, trámites operativos y prioridades de trabajo.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="rounded-xl border-border/60 text-xs font-bold gap-2">
            <Link href="/admin/calendar">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Calendario Operativo</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Progreso General</span>
            <span className="text-xs font-bold font-mono text-primary">{progressPercentage}%</span>
          </div>
          <div className="my-3">
            <Progress value={progressPercentage} className="h-2 rounded-full" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            {completedTasks} de {totalTasks} tareas finalizadas
          </p>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Tareas Pendientes</p>
            <h3 className="text-2xl font-black text-foreground">{pendingTasks.length}</h3>
            {urgentOrOverdue.length > 0 ? (
              <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {urgentOrOverdue.length} con prioridad o vencidas
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium">
                Sin urgencias ni atrasos
              </p>
            )}
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <Clock className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Tareas Realizadas</p>
            <h3 className="text-2xl font-black text-foreground">{completedTasks}</h3>
            <p className="text-[10px] text-muted-foreground font-medium">
              Completadas exitosamente
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <TaskList initialTasks={tasks as any} userId={session.user.id} />
    </div>
  );
}
