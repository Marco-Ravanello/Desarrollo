import prisma from "@/lib/prisma";
export async function createAuditLog(userId: string, action: string, entity: string, entityId: string, details?: any) { return await prisma.auditLog.create({ data: { userId, action, entity, entityId, details: details ? JSON.stringify(details) : null } }); }
export async function getAuditLogs() { return await prisma.auditLog.findMany({ include: { user: { include: { area: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); }
export async function getUsers() { return await prisma.user.findMany({ include: { area: true }, orderBy: { name: 'asc' } }); }
/** El último ingreso de cada usuario y desde cuándo se registran los ingresos. */
export async function getLastLogins(): Promise<{ byUser: Map<string, Date>; since: Date | null }> {
  const [rows, first] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["userId"], where: { action: "LOGIN" }, _max: { createdAt: true } }),
    prisma.auditLog.findFirst({ where: { action: "LOGIN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const byUser = new Map<string, Date>();
  for (const r of rows) if (r._max.createdAt) byUser.set(r.userId, r._max.createdAt);
  return { byUser, since: first?.createdAt ?? null };
}
export async function getUserById(id: string) { return await prisma.user.findUnique({ where: { id }, include: { area: true } }); }
export async function getTasks(userId: string) {
  return await prisma.task.findMany({
    where: { userId },
    orderBy: [
      { status: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' }
    ],
    // Los seguimientos agendados desde un expediente llevan a ese expediente.
    include: { case: { select: { id: true, title: true } } }
  });
}

export async function createTask(
  userId: string,
  title: string,
  description?: string,
  dueDate?: Date | null,
  priority?: any
) {
  return await prisma.task.create({
    data: {
      userId,
      title,
      description,
      dueDate,
      priority: priority || 'MEDIA',
      status: 'PENDIENTE'
    }
  });
}
export async function toggleTask(id: string, currentStatus: string) { const newStatus = currentStatus === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'; return await prisma.task.update({ where: { id }, data: { status: newStatus as any } }); }
export async function deleteTask(id: string) { return await prisma.task.delete({ where: { id } }); }
