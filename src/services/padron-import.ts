import prisma from "@/lib/prisma";
import type { PadronUnificado, Prisma } from "@prisma/client";
import type { PadronImportRecord, RowProblem } from "@/lib/padron-import";
import type { PadronProgramColumn } from "@/lib/padron-programs";
import { todayInArgentina } from "@/lib/follow-up-dates";

// Suma personas de una planilla al padrón unificado y las marca en un programa.
// A quien ya está en el padrón solo se le completan los datos vacíos: nunca se
// pisa lo que ya estaba cargado.

/** Datos de la planilla y la columna del padrón donde van. */
const FIELD_COLUMNS = [
  ["nombreCompleto", "nombre_completo"],
  ["direccion", "direccion"],
  ["barrio", "barrio"],
  ["localidad", "localidad"],
  ["telefono", "telefono"],
  ["email", "email"],
  ["fechaNacimiento", "fecha_nacimiento"],
  ["genero", "genero"],
  ["rol", "roles"],
] as const;

type PadronTextColumn = (typeof FIELD_COLUMNS)[number][1];

export interface PadronImportPlanItem {
  record: PadronImportRecord;
  existing: PadronUnificado | null;
  /** Datos vacíos del padrón que se completan con la planilla. */
  fill: Partial<Record<PadronTextColumn, string>>;
  /** La persona todavía no figura en el programa. */
  joinsProgram: boolean;
}

export interface PadronImportCounts {
  /** Personas nuevas en el padrón. */
  created: number;
  /** Personas que ya estaban y se les completan datos vacíos. */
  completed: number;
  /** Personas que quedan marcadas en el programa (nuevas o que ya estaban). */
  joined: number;
  /** Ya figuraban en el programa. */
  alreadyInProgram: number;
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

export async function planPadronImport(
  records: PadronImportRecord[],
  column: PadronProgramColumn,
  db: typeof prisma | Prisma.TransactionClient = prisma
): Promise<{ items: PadronImportPlanItem[]; errors: RowProblem[]; counts: PadronImportCounts }> {
  const existingRows = await db.padronUnificado.findMany({ where: { dni: { in: records.map((r) => r.dni) } } });
  const byDni = new Map(existingRows.map((p) => [p.dni, p]));

  const items: PadronImportPlanItem[] = [];
  const errors: RowProblem[] = [];
  const counts: PadronImportCounts = { created: 0, completed: 0, joined: 0, alreadyInProgram: 0 };

  for (const record of records) {
    const existing = byDni.get(record.dni) ?? null;
    if (!existing && !record.nombreCompleto) {
      errors.push({ row: record.row, message: `el DNI ${record.dni} no está en el padrón y la fila no trae nombre` });
      continue;
    }
    const fill: PadronImportPlanItem["fill"] = {};
    for (const [field, col] of FIELD_COLUMNS) {
      const value = record[field];
      if (value && (!existing || isEmpty(existing[col]))) fill[col] = value;
    }
    const joinsProgram = !existing || existing[column] !== 1;

    items.push({ record, existing, fill, joinsProgram });
    if (!existing) counts.created++;
    else if (Object.keys(fill).length > 0) counts.completed++;
    if (joinsProgram) counts.joined++;
    else counts.alreadyInProgram++;
  }
  return { items, errors, counts };
}

function appendProgram(current: string | null, label: string): string {
  const list = (current || "").split("|").map((p) => p.trim()).filter(Boolean);
  return [...list, label].join(" | ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Guarda una parte de la importación, todo o nada. */
export async function applyPadronImport(
  records: PadronImportRecord[],
  column: PadronProgramColumn,
  label: string,
  fileName: string,
  userId?: string | null
): Promise<{ counts: PadronImportCounts; errors: RowProblem[] }> {
  const now = new Date();
  const today = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const detalle = `Incorporado por importación de planilla el ${today}${fileName ? ` (archivo ${fileName.slice(0, 120)})` : ""}.`;

  return prisma.$transaction(
    async (tx) => {
      const { items, errors, counts } = await planPadronImport(records, column, tx);

      const newPeople = items.filter((i) => !i.existing);
      if (newPeople.length > 0) {
        await tx.padronUnificado.createMany({
          data: newPeople.map((i) => ({
            dni: i.record.dni,
            ...i.fill,
            cantidad_programas: 1,
            programas_activos: label,
            [column]: 1,
          })),
          skipDuplicates: true,
        });
      }

      for (const item of items) {
        if (!item.existing) continue;
        const data: Prisma.PadronUnificadoUpdateInput = { ...item.fill };
        if (item.joinsProgram) {
          Object.assign(data, {
            [column]: 1,
            cantidad_programas: { increment: 1 },
            programas_activos: appendProgram(item.existing.programas_activos, label),
          });
        }
        if (Object.keys(data).length > 0) {
          await tx.padronUnificado.update({ where: { dni: item.record.dni }, data });
        }
      }

      const joining = items.filter((i) => i.joinsProgram);
      if (joining.length > 0) {
        await tx.participacionPrograma.createMany({
          data: joining.map(({ record, existing }) => ({
            dni: record.dni,
            nombre_completo: existing?.nombre_completo || record.nombreCompleto || null,
            programa: label,
            roles: record.rol || null,
            cantidad_registros: 1,
            detalle_destacado: detalle,
            telefono: record.telefono || existing?.telefono || null,
            email: record.email || existing?.email || null,
            direccion: record.direccion || existing?.direccion || null,
            localidad: record.localidad || existing?.localidad || null,
            barrio: record.barrio || existing?.barrio || null,
          })),
        });
      }

      if (joining.length > 0) {
        // La historia de altas: cada persona que entra al programa por la planilla.
        const fecha = new Date(`${todayInArgentina(now)}T00:00:00.000Z`);
        await tx.padronMovimiento.createMany({
          data: joining.map(({ record }) => ({
            dni: record.dni,
            programa: column,
            tipo: "ALTA",
            fecha,
            motivo: fileName ? `Planilla ${fileName.slice(0, 120)}` : "Importación de planilla",
            origen: "IMPORTACION",
            userId: userId ?? null,
          })),
        });
      }

      return { counts, errors };
    },
    { timeout: 60000, maxWait: 15000 }
  );
}
