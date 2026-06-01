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

export async function createCase(data: any) {
  return await prisma.case.create({
    data: {
      personId: data.personId,
      areaId: data.areaId,
      title: data.title,
      description: data.description,
      status: 'ABIERTO',
      priority: data.priority || 'MEDIA'
    }
  });
}

export async function getAreas() {
  return await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function getCaseById(id: string) {
  return await prisma.case.findUnique({
    where: { id },
    include: {
      person: true,
      area: true,
      interventions: {
        orderBy: { date: 'desc' }
      },
      documents: true
    }
  });
}
