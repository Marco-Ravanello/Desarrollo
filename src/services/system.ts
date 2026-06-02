import prisma from "@/lib/prisma";

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  details?: any
) {
  return await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function getUsers() {
  return await prisma.user.findMany({
    include: { area: true },
    orderBy: { name: 'asc' }
  });
}

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    include: { area: true }
  });
}
