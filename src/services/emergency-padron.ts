import prisma from "@/lib/prisma";
import { normalizeDni } from "@/lib/padron-import";

// Personas de las fichas de tormenta en el padrón unificado.

export interface StormPadronData {
  dni?: string | null;
  nombreApellido?: string | null;
  domicilio?: string | null;
  barrio?: string | null;
  contacto?: string | null;
  edad?: string | null;
}

const text = (value: string | null | undefined, max = 200) => {
  const t = String(value ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** Programa del padrón que marcan las fichas de tormenta. */
export const STORM_PROGRAM = { label: "Emergencia climática", column: "prog_emergencia_climatica" } as const;

export type StormPadronOutcome = "created" | "joined" | "existing" | "no-dni";

/**
 * Marca a la persona de la ficha en el programa "Emergencia climática" del padrón.
 * - Si no está en el padrón, la suma con los datos de la ficha.
 * - Si ya está, solo la suma al programa: sus datos no se cambian.
 */
export async function addStormPersonToPadron(data: StormPadronData, userId: string): Promise<StormPadronOutcome> {
  const dni = normalizeDni(data.dni);
  if (!dni) return "no-dni";
  const nombre = text(data.nombreApellido);
  const domicilio = text(data.domicilio);
  const direccion = domicilio && !/^sin especificaci[oó]n$/i.test(domicilio) ? domicilio : null;
  const barrio = text(data.barrio, 120);
  const telefono = text(data.contacto, 60);

  const { count: created } = await prisma.padronUnificado.createMany({
    data: [{
      dni,
      nombre_completo: nombre,
      direccion,
      barrio,
      telefono,
      edad_aprox: text(data.edad, 20),
      cantidad_programas: 1,
      programas_activos: STORM_PROGRAM.label,
      [STORM_PROGRAM.column]: 1,
    }],
    // Si dos fichas de la misma persona llegan juntas, entra una sola vez.
    skipDuplicates: true,
  });

  // Ya estaba en el padrón: se suma al programa una sola vez.
  const joined = created
    ? 0
    : await prisma.$executeRawUnsafe(
        `UPDATE padron_unificado
         SET ${STORM_PROGRAM.column} = 1,
             cantidad_programas = cantidad_programas + 1,
             programas_activos = CASE WHEN COALESCE(trim(programas_activos), '') = '' THEN $2 ELSE programas_activos || ' | ' || $2 END
         WHERE dni = $1 AND ${STORM_PROGRAM.column} = 0`,
        dni,
        STORM_PROGRAM.label
      );

  if (!created && !joined) return "existing";

  const now = new Date();
  const today = now.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  await prisma.participacionPrograma.create({
    data: {
      dni,
      nombre_completo: nombre,
      programa: STORM_PROGRAM.label,
      cantidad_registros: 1,
      detalle_destacado: `Relevado en una ficha de tormenta el ${today}.`,
      telefono,
      direccion,
      barrio,
    },
  });

  await prisma.auditLog
    .create({
      data: {
        userId,
        action: created ? "PADRON_ALTA_EMERGENCIA" : "PADRON_PROGRAMA_EMERGENCIA",
        entity: "PadronUnificado",
        entityId: dni,
        details: created
          ? `Persona sumada al padrón desde una ficha de tormenta: ${nombre || "sin nombre"} (DNI ${dni}), programa ${STORM_PROGRAM.label}.`
          : `Persona del padrón sumada al programa ${STORM_PROGRAM.label} por una ficha de tormenta: ${nombre || "sin nombre"} (DNI ${dni}).`,
      },
    })
    .catch((err) => console.warn("AuditLog creation skipped:", err));
  return created ? "created" : "joined";
}

/** Lo que hay cargado con ese DNI, para confirmar que es la misma persona antes de unirla. */
export async function lookupStormDni(rawDni: string) {
  const dni = normalizeDni(rawDni);
  if (!dni) return null;
  const padron = await prisma.padronUnificado.findUnique({
    where: { dni },
    select: { nombre_completo: true, direccion: true, barrio: true, localidad: true },
  });
  return {
    dni,
    padron: padron
      ? {
          nombre: padron.nombre_completo || "Sin nombre",
          direccion: [padron.direccion, padron.barrio || padron.localidad].filter(Boolean).join(" · ") || null,
        }
      : null,
  };
}
