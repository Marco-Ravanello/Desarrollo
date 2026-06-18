"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function exportInterventionsAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");

  const interventions = await prisma.intervention.findMany({
    include: {
      person: true,
      case: {
        include: { area: true }
      }
    },
    orderBy: { date: 'desc' }
  });

  return interventions.map(i => ({
    Fecha: i.date.toLocaleDateString('es-AR'),
    Ciudadano: `${i.person.lastName}, ${i.person.firstName}`,
    DNI: i.person.dni,
    Area: i.case.area.name,
    Caso: i.case.title,
    Descripcion: i.description
  }));
}

export async function importInterventionsAction(data: any[]) {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");

  let createdCount = 0;
  let errors = [];

  for (const row of data) {
    try {
      const { DNI, Nombre, Apellido, Area, Caso, Descripcion, Fecha } = row;

      // 1. Find or create Person
      let person = await prisma.person.findUnique({ where: { dni: String(DNI) } });
      if (!person) {
        person = await prisma.person.create({
          data: {
            dni: String(DNI),
            firstName: Nombre || "S/N",
            lastName: Apellido || "S/A",
          }
        });
      }

      // 2. Find Area
      const area = await prisma.area.findFirst({
        where: { name: { contains: Area, mode: 'insensitive' } }
      });

      if (!area) {
        errors.push(`Área no encontrada: ${Area} para DNI ${DNI}`);
        continue;
      }

      // 3. Find or create Case
      let dbCase = await prisma.case.findFirst({
        where: {
          personId: person.id,
          areaId: area.id,
          title: Caso
        }
      });

      if (!dbCase) {
        dbCase = await prisma.case.create({
          data: {
            personId: person.id,
            areaId: area.id,
            title: Caso,
            status: 'ABIERTO'
          }
        });
      }

      // 4. Create Intervention
      await prisma.intervention.create({
        data: {
          caseId: dbCase.id,
          personId: person.id,
          description: Descripcion,
          date: Fecha ? new Date(Fecha) : new Date(),
          userId: session.user.id!
        }
      });

      createdCount++;
    } catch (e: any) {
      errors.push(`Error en fila ${DNI}: ${e.message}`);
    }
  }

  revalidatePath("/admin/interventions");
  revalidatePath("/people");

  return { success: true, createdCount, errors };
}
