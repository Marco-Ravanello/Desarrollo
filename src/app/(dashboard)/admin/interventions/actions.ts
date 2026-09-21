"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function exportInterventionsAction() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const role = session.user.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN_GENERAL" && role !== "DIRECCION_GENERAL") {
    throw new Error("No tiene permisos para exportar datos sociales de intervenciones");
  }

  const interventions = await prisma.intervention.findMany({
    include: {
      person: true,
      case: {
        include: { area: true }
      }
    },
    orderBy: { date: 'desc' }
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'EXPORT_INTERVENTIONS',
      entity: 'Intervention',
      entityId: 'ALL',
      details: `Exportación masiva de ${interventions.length} registros de intervenciones sociales`
    }
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
  let errors: string[] = [];

  const validRows = data.filter(row => {
    const dni = String(row.DNI || row.dni || row.Documento || "").trim();
    if (!dni) {
      errors.push("Fila saltada: DNI faltante");
      return false;
    }
    return true;
  });

  if (validRows.length === 0) {
    return { success: true, createdCount: 0, errors };
  }

  const uniqueDnis = Array.from(new Set(validRows.map(row => String(row.DNI || row.dni || row.Documento || "").trim())));

  // 1. Bulk preload existing persons and areas
  const existingPersons = await prisma.person.findMany({
    where: { dni: { in: uniqueDnis } }
  });
  const personMap = new Map(existingPersons.map(p => [p.dni, p]));

  const allAreas = await prisma.area.findMany();
  const areaMap = new Map(allAreas.map(a => [a.name.toLowerCase().trim(), a]));

  // Find missing persons and create them in bulk
  const missingPersonsList: { dni: string; firstName: string; lastName: string }[] = [];
  for (const row of validRows) {
    const dni = String(row.DNI || row.dni || row.Documento || "").trim();
    if (!personMap.has(dni) && !missingPersonsList.some(p => p.dni === dni)) {
      const Nombre = String(row.Nombre || row.firstName || "").trim() || "S/N";
      const Apellido = String(row.Apellido || row.lastName || "").trim() || "S/A";
      missingPersonsList.push({
        dni,
        firstName: Nombre,
        lastName: Apellido
      });
    }
  }

  if (missingPersonsList.length > 0) {
    await prisma.person.createMany({
      data: missingPersonsList,
      skipDuplicates: true
    });

    const newlyCreatedPersons = await prisma.person.findMany({
      where: { dni: { in: missingPersonsList.map(p => p.dni) } }
    });
    newlyCreatedPersons.forEach(p => personMap.set(p.dni, p));
  }

  const personIds = Array.from(personMap.values()).map(p => p.id);
  const existingCases = await prisma.case.findMany({
    where: { personId: { in: personIds } }
  });
  const caseMap = new Map(existingCases.map(c => [`${c.personId}_${c.areaId}_${c.title}`, c]));

  for (const row of validRows) {
    try {
      const DNI = String(row.DNI || row.dni || row.Documento || "").trim();
      const AreaName = String(row.Area || row.area || "").toLowerCase().trim();
      const Caso = String(row.Caso || row.Asunto || row.title || "Caso Migrado").trim();
      const Descripcion = String(row.Descripcion || row.Observaciones || row.description || "Sin descripción");
      const FechaStr = row.Fecha || row.date || null;

      const person = personMap.get(DNI);
      if (!person) {
        errors.push(`Persona no encontrada para DNI ${DNI}`);
        continue;
      }

      let area = areaMap.get(AreaName);
      if (!area) {
        for (const [name, a] of areaMap.entries()) {
          if (name.includes(AreaName) || AreaName.includes(name)) {
            area = a;
            break;
          }
        }
      }

      if (!area) {
        errors.push(`Área no encontrada: ${row.Area || row.area} para DNI ${DNI}`);
        continue;
      }

      const caseKey = `${person.id}_${area.id}_${Caso}`;
      let dbCase = caseMap.get(caseKey);

      if (!dbCase) {
        dbCase = await prisma.case.create({
          data: {
            personId: person.id,
            areaId: area.id,
            title: Caso,
            status: 'ABIERTO'
          }
        });
        caseMap.set(caseKey, dbCase);
      }

      await prisma.intervention.create({
        data: {
          caseId: dbCase.id,
          personId: person.id,
          description: Descripcion,
          date: FechaStr ? new Date(FechaStr) : new Date(),
          userId: session.user.id!
        }
      });

      createdCount++;
    } catch (e: any) {
      errors.push(`Error en fila: ${e.message}`);
    }
  }

  revalidatePath("/admin/interventions");
  revalidatePath("/people");

  return { success: true, createdCount, errors };
}
