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
