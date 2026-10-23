"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { ensurePersonInPrisma } from "@/services/people";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { formatFecha } from "@/lib/fechas";

export async function exportInterventionsAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const role = session.user.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN_GENERAL" && role !== "DIRECCION_GENERAL") {
    return { success: false as const, error: "No se pudo exportar: tu rol no tiene permiso para exportar intervenciones." };
  }

  try {
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

    const rows = interventions.map(i => ({
      Fecha: formatFecha(i.date),
      Persona: `${i.person.lastName}, ${i.person.firstName}`,
      DNI: i.person.dni,
      Area: i.case.area.name,
      Caso: i.case.title,
      Descripcion: i.description
    }));
    return { success: true as const, rows };
  } catch (error) {
    console.error("Error en exportInterventionsAction:", error);
    return { success: false as const, error: actionErrorMessage(error, "No se pudo exportar") };
  }
}

export async function importInterventionsAction(data: any[]) {
  const session = await auth();
  if (session?.user && !MANAGEMENT_ROLES.includes(session.user.role)) {
    return { success: false, createdCount: 0, errors: ["No se pudo importar: tu rol no tiene permiso para importar datos."] };
  }
  if (!session?.user) {
    return { success: false, createdCount: 0, errors: ["Tu sesión expiró. Volvé a iniciar sesión."] };
  }

  let createdCount = 0;
  const errors: string[] = [];

  // Solo se cargan datos reales: si falta algo, la fila se saltea y se avisa por qué.
  // Nunca se crean personas con nombres de relleno ("S/N") ni fechas inventadas.
  const rows = data.map((row, index) => ({
    row,
    rowNumber: index + 2, // fila 1 = encabezados en la planilla
    dni: String(row.DNI || row.dni || row.Documento || "").replace(/[^0-9]/g, ""),
  }));

  const withDni = rows.filter(({ dni, rowNumber }) => {
    if (!dni) {
      errors.push(`Fila ${rowNumber}: falta el DNI.`);
      return false;
    }
    return true;
  });

  if (withDni.length === 0) {
    return { success: true, createdCount: 0, errors };
  }

  const uniqueDnis = Array.from(new Set(withDni.map((r) => r.dni)));

  const existingPersons = await prisma.person.findMany({ where: { dni: { in: uniqueDnis } } });
  const personMap = new Map(existingPersons.map((p) => [p.dni, p]));

  // Personas que no están en el Registro Único: se buscan en el padrón unificado y,
  // si no figuran, se crean solo si la planilla trae nombre y apellido reales.
  for (const { row, dni } of withDni) {
    if (personMap.has(dni)) continue;
    const fromPadron = await ensurePersonInPrisma(dni).catch(() => null);
    if (fromPadron) {
      personMap.set(dni, fromPadron);
      continue;
    }
    const firstName = String(row.Nombre || row.firstName || "").trim();
    const lastName = String(row.Apellido || row.lastName || "").trim();
    if (firstName && lastName) {
      const created = await prisma.person.upsert({
        where: { dni },
        update: {},
        create: { dni, firstName, lastName },
      });
      personMap.set(dni, created);
    }
  }

  const allAreas = await prisma.area.findMany();
  const areaMap = new Map(allAreas.map((a) => [a.name.toLowerCase().trim(), a]));

  const personIds = Array.from(personMap.values()).map((p) => p.id);
  const existingCases = await prisma.case.findMany({ where: { personId: { in: personIds } } });
  const caseMap = new Map(existingCases.map((c) => [`${c.personId}_${c.areaId}_${c.title}`, c]));

  for (const { row, rowNumber, dni } of withDni) {
    try {
      const person = personMap.get(dni);
      if (!person) {
        errors.push(`Fila ${rowNumber}: el DNI ${dni} no está en el Registro Único ni en el padrón, y la planilla no trae nombre y apellido. Cargá primero a la persona.`);
        continue;
      }

      const areaName = String(row.Area || row.area || "").toLowerCase().trim();
      if (!areaName) {
        errors.push(`Fila ${rowNumber}: falta el área.`);
        continue;
      }
      let area = areaMap.get(areaName);
      if (!area) {
        for (const [name, a] of areaMap.entries()) {
          if (name.includes(areaName) || areaName.includes(name)) {
            area = a;
            break;
          }
        }
      }
      if (!area) {
        errors.push(`Fila ${rowNumber}: no existe el área "${row.Area || row.area}".`);
        continue;
      }

      const caseTitle = String(row.Caso || row.Asunto || row.title || "").trim();
      if (!caseTitle) {
        errors.push(`Fila ${rowNumber}: falta el nombre del caso.`);
        continue;
      }

      const description = String(row.Descripcion || row.Observaciones || row.description || "").trim();
      if (!description) {
        errors.push(`Fila ${rowNumber}: falta la descripción de la intervención.`);
        continue;
      }

      const date = parseSheetDate(row.Fecha ?? row.date);
      if (!date) {
        errors.push(`Fila ${rowNumber}: falta la fecha o no se entiende (usá dd/mm/aaaa).`);
        continue;
      }

      const caseKey = `${person.id}_${area.id}_${caseTitle}`;
      let dbCase = caseMap.get(caseKey);
      if (!dbCase) {
        dbCase = await prisma.case.create({
          data: { personId: person.id, areaId: area.id, title: caseTitle, status: "ABIERTO" },
        });
        caseMap.set(caseKey, dbCase);
      }

      await prisma.intervention.create({
        data: {
          caseId: dbCase.id,
          personId: person.id,
          description,
          date,
          userId: session.user.id!,
        },
      });

      createdCount++;
    } catch (e) {
      errors.push(actionErrorMessage(e, `Fila ${rowNumber}: no se pudo importar`));
    }
  }

  revalidatePath("/admin/interventions");
  revalidatePath("/people");

  return { success: true, createdCount, errors };
}

// Fechas de planilla: número de serie de Excel, "dd/mm/aaaa", "aaaa-mm-dd" u objeto Date.
function parseSheetDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    // Excel cuenta días desde el 30/12/1899.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return isNaN(date.getTime()) ? null : date;
  }
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const date = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 12);
    return date.getDate() === Number(dmy[1]) ? date : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}
