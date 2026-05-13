import prisma from "@/lib/prisma";

export async function getCasesByArea(areaName: string) {
  return await prisma.case.findMany({
    where: {
      area: { name: areaName }
    },
    include: {
      person: true,
      interventions: {
        orderBy: { date: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
}
