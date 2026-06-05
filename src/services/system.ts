import prisma from "@/lib/prisma";
export async function createAuditLog(userId: string, action: string, entity: string, entityId: string, details?: any) { return await prisma.auditLog.create({ data: { userId, action, entity, entityId, details: details ? JSON.stringify(details) : null } }); }
export async function getAuditLogs() { return await prisma.auditLog.findMany({ include: { user: { include: { area: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); }
export async function getUsers() { return await prisma.user.findMany({ include: { area: true }, orderBy: { name: 'asc' } }); }
export async function getUserById(id: string) { return await prisma.user.findUnique({ where: { id }, include: { area: true } }); }
export async function getTasks(userId: string) { return await prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
export async function createTask(userId: string, title: string, description?: string) { return await prisma.task.create({ data: { userId, title, description, status: 'PENDIENTE' } }); }
export async function toggleTask(id: string, currentStatus: string) { const newStatus = currentStatus === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA'; return await prisma.task.update({ where: { id }, data: { status: newStatus as any } }); }
export async function deleteTask(id: string) { return await prisma.task.delete({ where: { id } }); }
