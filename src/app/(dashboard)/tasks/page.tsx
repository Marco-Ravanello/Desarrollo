export const dynamic = "force-dynamic";
import { getTasks } from "@/services/system";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TaskList } from "./task-list";
export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const tasks = await getTasks(session.user.id!);
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h2 className="text-3xl font-bold tracking-tight">Mis Pendientes</h2><p className="text-slate-500">Organice sus tareas diarias y seguimiento de casos.</p></div>
      <TaskList initialTasks={tasks as any} userId={session.user.id!} />
    </div>
  );
}
