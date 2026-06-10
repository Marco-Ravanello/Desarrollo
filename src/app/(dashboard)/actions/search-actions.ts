"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function searchGlobalAction(query: string) {
  const session = await auth();
  if (!session || !query || query.length < 2) return { citizens: [], cases: [], hr: [] };

  const [citizens, cases, hr] = await Promise.all([
    // Buscar Ciudadanos
    prisma.person.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { dni: { contains: query } },
        ]
      },
      select: { id: true, firstName: true, lastName: true, dni: true },
      take: 5
    }),

    // Buscar Expedientes (Casos)
    prisma.case.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { id: { contains: query, mode: 'insensitive' } },
        ]
      },
      include: { area: { select: { name: true } } },
      take: 5
    }),

    // Buscar RRHH
    prisma.hrRecord.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { dni: { contains: query } },
          { fileNumber: { contains: query } },
        ]
      },
      include: { area: { select: { name: true } } },
      take: 5
    })
  ]);

  return {
    citizens: citizens.map(c => ({
      id: c.id,
      title: `${c.lastName}, ${c.firstName}`,
      subtitle: `DNI ${c.dni}`,
      url: `/people/${c.id}`
    })),
    cases: cases.map(c => ({
      id: c.id,
      title: c.title,
      subtitle: `${c.area.name} • ID: ${c.id.substring(0, 8)}`,
      url: `/cases/${c.id}`
    })),
    hr: hr.map(h => ({
      id: h.id,
      title: `${h.lastName}, ${h.firstName}`,
      subtitle: `${h.area?.name || 'Sin Área'} • Leg. ${h.fileNumber || '---'}`,
      url: `/admin/hr` // Link directly to HR list for now, or specific view if it existed
    }))
  };
}
