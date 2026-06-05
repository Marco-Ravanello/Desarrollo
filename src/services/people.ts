import prisma from "@/lib/prisma";

export async function getPeople(query?: string) {
  return await prisma.person.findMany({
    where: query ? {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { dni: { contains: query } },
      ]
    } : undefined,
    include: {
      family: true,
      cases: {
        include: {
          area: true
        }
      },
      _count: {
        select: { cases: true }
      }
    },
    orderBy: { lastName: 'asc' }
  });
}

export async function getPersonById(id: string) {
  return await prisma.person.findUnique({
    where: { id },
    include: {
      family: {
        include: { members: true }
      },
      cases: {
        include: { area: true }
      },
      interventions: {
        orderBy: { date: 'desc' }
      },
      documents: true
    }
  });
}

export async function createPerson(data: any) {
  return await prisma.person.create({
    data: {
      dni: data.dni,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      address: data.address,
      phone: data.phone,
      email: data.email,
    }
  });
}

export async function updatePerson(id: string, data: any) {
  return await prisma.person.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      address: data.address,
      phone: data.phone,
      email: data.email,
    }
  });
}
