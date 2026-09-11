"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function searchGlobalAction(query: string) {
  const session = await auth();
  const trimmedQuery = query?.trim();
  if (!session || !trimmedQuery || trimmedQuery.length < 2) return { citizens: [], cases: [], hr: [], agreements: [] };

  // Sanitizar DNI para búsqueda (quitar puntos o guiones)
  const numericQuery = trimmedQuery.replace(/[^0-9]/g, '');

  const [citizens, cases, hr, agreements] = await Promise.all([
    // Buscar Ciudadanos
    prisma.person.findMany({
      where: {
        OR: [
          { firstName: { contains: trimmedQuery, mode: 'insensitive' } },
          { lastName: { contains: trimmedQuery, mode: 'insensitive' } },
          { dni: { contains: trimmedQuery } },
          ...(numericQuery ? [{ dni: { contains: numericQuery } }] : [])
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
    prisma.hRRecord.findMany({
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
    }),

    // Buscar Convenios
    prisma.agreement.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { number: { contains: query, mode: 'insensitive' } },
          { parties: { contains: query, mode: 'insensitive' } },
        ]
      },
      include: { area: { select: { name: true } } },
      take: 5
    })
  ]);

  // Buscar Ciudadanos en padron_unificado
  let padronCitizens: any[] = [];
  try {
    const q = trimmedQuery.replace(/'/g, "''");
    const numQ = numericQuery;
    let whereSQL = `LOWER(nombre_completo) LIKE '%${q.toLowerCase()}%'`;
    if (numQ && numQ.length >= 4) {
      whereSQL += ` OR dni LIKE '%${numQ}%'`;
    }
    padronCitizens = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, barrio FROM padron_unificado WHERE ${whereSQL} LIMIT 5;`
    );
  } catch (e) {
    console.error("Error searching padron in global search:", e);
  }

  const padronResults = padronCitizens.map((p: any) => ({
    id: p.dni,
    title: p.nombre_completo,
    subtitle: `DNI ${p.dni}${p.barrio ? ` • ${p.barrio}` : ''}`,
    url: `/people/${p.dni}`
  }));

  // Fusionar evitando DNIs duplicados
  const existingDnis = new Set(citizens.map((c: any) => c.dni));
  const mergedCitizens = [
    ...citizens.map((c: any) => ({
      id: c.id,
      title: `${c.lastName}, ${c.firstName}`,
      subtitle: `DNI ${c.dni}`,
      url: `/people/${c.id}`
    })),
    ...padronResults.filter((p: any) => !existingDnis.has(p.id))
  ].slice(0, 5);

  return {
    citizens: mergedCitizens,
    cases: cases.map((c: any) => ({
      id: c.id,
      title: c.title,
      subtitle: `${c.area.name} • ID: ${c.id.substring(0, 8)}`,
      url: `/cases/${c.id}`
    })),
    hr: hr.map((h: any) => ({
      id: h.id,
      title: `${h.lastName}, ${h.firstName}`,
      subtitle: `${h.area?.name || 'Sin Área'} • Leg. ${h.fileNumber || '---'}`,
      url: `/admin/hr`
    })),
    agreements: agreements.map((a: any) => ({
      id: a.id,
      title: a.title,
      subtitle: `${a.area?.name || 'Global'} • ${a.number || 'No. Registro'}`,
      url: `/admin/agreements`
    }))
  };
}
