export const dynamic = "force-dynamic";

import { getTasks } from "@/services/system";
import { getShareableUsers } from "@/services/tasks";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TaskList } from "./task-list";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Clock, Calendar, AlertTriangle, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { diaAR, diaDeVencimiento } from "@/lib/fechas";

export const metadata = { title: "Mis tareas" };

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [tasks, users] = await Promise.all([getTasks(session.user.id), getShareableUsers(session.user.id)]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETADA").length;
  const pendingTasks = tasks.filter((t) => t.status !== "COMPLETADA");
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const hoy = diaAR();

  const urgentOrOverdue = pendingTasks.filter((t) => {
    const isUrgent = (t as any).priority === "URGENTE";
    const isOverdue = t.dueDate ? diaDeVencimiento(t.dueDate) < hoy : false;
    return isUrgent || isOverdue;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Mis tareas"
        description="Lo que tenés pendiente, con su fecha y su prioridad."
        icon={CheckCircle2}
        actions={
          <Button variant="outline" asChild className="rounded-xl border-border/60 text-xs font-bold gap-2">
            <Link href="/admin/calendar">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Ver en la agenda</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="col-span-2 lg:col-span-1 bg-card text-card-foreground border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">Progreso general</span>
            <span className="text-xs font-bold font-mono text-primary">{progressPercentage}%</span>
          </div>
          <div className="my-3">
            <Progress value={progressPercentage} className="h-2 rounded-full" />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedTasks} de {totalTasks} tareas finalizadas
          </p>
        </Card>

        <StatCard
          label="Tareas pendientes"
          value={pendingTasks.length}
          hint={
            urgentOrOverdue.length > 0 ? (
              <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {urgentOrOverdue.length} con prioridad o vencidas
              </span>
            ) : (
              "Sin urgencias ni atrasos"
            )
          }
          icon={Clock}
          tone="orange"
        />

        <StatCard
          label="Tareas realizadas"
          value={completedTasks}
          hint="Completadas exitosamente"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      <TaskList initialTasks={tasks as any} userId={session.user.id} users={users} />
    </div>
  );
}
