import prisma from "@/lib/prisma";
import { LOCALIDADES_3F, mergeOptions, type AddressOptions } from "@/lib/localidades";
import { STORM_BARRIOS } from "@/lib/storm-barrios";
import { fechaIsoATexto, parseFechaNacimiento, personAddress, splitNombreCompleto } from "@/lib/person-display";
import { relocateAfterAddressChange, type RelocateResult } from "@/services/geocoding";

// Datos de contacto de una persona: los que muestra su ficha y corrige "Editar datos".
// La ficha muestra el padrón, así que se corrige el padrón. Si además tiene legajo viejo
// en el Registro Único (lo que se ve adentro de los expedientes), se corrige igual.

export interface PersonDataFields {
  firstName: string;
  lastName: string;
  direccion: string;
  barrio: string;
  localidad: string;
  telefono: string;
  email: string;
  /** "AAAA-MM-DD" o vacío. */
  fechaNacimiento: string;
  genero: string;
}

export interface PersonEditData extends PersonDataFields {
  dni: string;
  /** La fecha del padrón cuando está escrita de una forma que no se entiende (se muestra para no perderla). */
  fechaNacimientoTexto: string | null;
}

const LABELS: Record<keyof PersonDataFields, string> = {
  firstName: "Nombre",
  lastName: "Apellido",
  direccion: "Calle y altura",
  barrio: "Barrio",
  localidad: "Localidad",
  telefono: "Teléfono",
  email: "Correo",
  fechaNacimiento: "Fecha de nacimiento",
  genero: "Género",
};

const clean = (v: unknown, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Localidades y barrios para elegir: los del partido y los que ya están escritos en el padrón. */
export async function getAddressOptions(): Promise<AddressOptions> {
  const [localidades, barrios] = await Promise.all([
    prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT trim(localidad) AS v FROM padron_unificado WHERE trim(COALESCE(localidad, '')) <> '' GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 40`
    ),
    prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT trim(barrio) AS v FROM padron_unificado WHERE trim(COALESCE(barrio, '')) <> '' GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 150`
    ),
  ]);
  return {
    localidades: mergeOptions(LOCALIDADES_3F, localidades.map((r) => r.v)),
    barrios: mergeOptions(STORM_BARRIOS, barrios.map((r) => r.v)),
  };
}

/** Lo que hoy tiene cargado la persona, para abrir "Editar datos". */
export async function getPersonEditData(dni: string): Promise<PersonEditData | null> {
  const padron = await prisma.padronUnificado.findUnique({
    where: { dni },
    select: { nombre_completo: true, direccion: true, barrio: true, localidad: true, telefono: true, email: true, fecha_nacimiento: true, genero: true },
  });
  if (padron) {
    const { firstName, lastName } = splitNombreCompleto(padron.nombre_completo);
    const iso = parseFechaNacimiento(padron.fecha_nacimiento);
    return {
      dni,
      firstName,
      lastName,
      direccion: padron.direccion || "",
      barrio: padron.barrio || "",
      localidad: padron.localidad || "",
      telefono: padron.telefono || "",
      email: padron.email || "",
      fechaNacimiento: iso || "",
      fechaNacimientoTexto: !iso && padron.fecha_nacimiento?.trim() ? padron.fecha_nacimiento.trim() : null,
      genero: padron.genero || "",
    };
  }
  const person = await prisma.person.findUnique({ where: { dni } });
  if (!person) return null;
  return {
    dni,
    firstName: person.firstName,
    lastName: person.lastName,
    direccion: person.address || "",
    barrio: "",
    localidad: "",
    telefono: person.phone || "",
    email: person.email || "",
    fechaNacimiento: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : "",
    fechaNacimientoTexto: null,
    genero: person.gender || "",
  };
}

/** Limpia y controla lo que llega del formulario. Devuelve el error para mostrar, si hay. */
export function parsePersonDataForm(formData: FormData): { data: PersonDataFields } | { error: string } {
  const data: PersonDataFields = {
    firstName: clean(formData.get("firstName"), 100),
    lastName: clean(formData.get("lastName"), 100),
    direccion: clean(formData.get("direccion")),
    barrio: clean(formData.get("barrio"), 100),
    localidad: clean(formData.get("localidad"), 100),
    telefono: clean(formData.get("telefono"), 60),
    email: clean(formData.get("email"), 120).toLowerCase(),
    fechaNacimiento: clean(formData.get("fechaNacimiento"), 10),
    genero: clean(formData.get("genero"), 40),
  };
  if (!data.firstName || !data.lastName) return { error: "Completá el nombre y el apellido." };
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: "El correo no parece válido. Revisalo o dejalo vacío." };
  if (data.fechaNacimiento) {
    if (parseFechaNacimiento(data.fechaNacimiento) !== data.fechaNacimiento) return { error: "La fecha de nacimiento no es válida." };
    const year = Number(data.fechaNacimiento.slice(0, 4));
    if (year < 1900 || data.fechaNacimiento > new Date().toISOString().slice(0, 10)) {
      return { error: "La fecha de nacimiento no puede ser futura ni anterior a 1900." };
    }
  }
  return { data };
}

/** Dirección completa en un solo texto, para el legajo del Registro Único (que no tiene barrio ni localidad aparte). */
export function fullAddress(d: Pick<PersonDataFields, "direccion" | "barrio" | "localidad">): string {
  const base = personAddress(d.direccion, d.barrio, null);
  const loc = d.localidad.trim();
  if (!d.direccion.trim() && !d.barrio.trim()) return loc;
  return loc && !base.toLowerCase().includes(loc.toLowerCase()) ? `${base}, ${loc}` : base;
}

export interface PersonDataChange {
  campo: string;
  antes: string;
  despues: string;
}

export interface UpdatePersonDataResult {
  cambios: PersonDataChange[];
  /** Solo si cambió la dirección de alguien del padrón. */
  ubicacion?: RelocateResult;
}

const ADDRESS_FIELDS: (keyof PersonDataFields)[] = ["direccion", "barrio", "localidad"];

/**
 * Corrige los datos de una persona (el DNI no se cambia) y deja anotado qué cambió:
 * en la Auditoría y en la Historia de su ficha. Si cambió la dirección, busca el punto nuevo en el mapa.
 */
export async function updatePersonData(dni: string, data: PersonDataFields, userId: string): Promise<UpdatePersonDataResult | null> {
  const current = await getPersonEditData(dni);
  if (!current) return null;

  const changed = (Object.keys(LABELS) as (keyof PersonDataFields)[]).filter((k) => {
    // Una fecha del padrón que no se entendía no se pisa si el campo quedó vacío.
    if (k === "fechaNacimiento" && !data.fechaNacimiento && current.fechaNacimientoTexto) return false;
    return data[k] !== current[k];
  });
  if (changed.length === 0) return { cambios: [] };

  const show = (k: keyof PersonDataFields, v: string) => (k === "fechaNacimiento" && v ? fechaIsoATexto(v) : v);
  const cambios: PersonDataChange[] = changed.map((k) => ({
    campo: LABELS[k],
    antes: k === "fechaNacimiento" && !current.fechaNacimiento && current.fechaNacimientoTexto ? current.fechaNacimientoTexto : show(k, current[k]),
    despues: show(k, data[k]),
  }));
  const has = (k: keyof PersonDataFields) => changed.includes(k);
  const nameChanged = has("firstName") || has("lastName");
  const addressChanged = ADDRESS_FIELDS.some(has);
  const birth = data.fechaNacimiento ? new Date(`${data.fechaNacimiento}T12:00:00Z`) : null;

  const padron = await prisma.padronUnificado.findUnique({ where: { dni }, select: { dni: true } });
  await prisma.$transaction(async (tx) => {
    if (padron) {
      await tx.padronUnificado.update({
        where: { dni },
        data: {
          ...(nameChanged ? { nombre_completo: `${data.lastName}, ${data.firstName}` } : {}),
          ...(has("direccion") ? { direccion: data.direccion || null } : {}),
          ...(has("barrio") ? { barrio: data.barrio || null } : {}),
          ...(has("localidad") ? { localidad: data.localidad || null } : {}),
          ...(has("telefono") ? { telefono: data.telefono || null } : {}),
          ...(has("email") ? { email: data.email || null } : {}),
          ...(has("fechaNacimiento") ? { fecha_nacimiento: data.fechaNacimiento ? fechaIsoATexto(data.fechaNacimiento) : null } : {}),
          ...(has("genero") ? { genero: data.genero || null } : {}),
        },
      });
    }
    // El legajo del Registro Único con el mismo DNI (si tiene) queda igual que el padrón.
    await tx.person.updateMany({
      where: { dni },
      data: {
        ...(nameChanged ? { firstName: data.firstName, lastName: data.lastName } : {}),
        ...(addressChanged ? { address: fullAddress(data) || null, ...(padron ? {} : { latitude: null, longitude: null }) } : {}),
        ...(has("telefono") ? { phone: data.telefono || null } : {}),
        ...(has("email") ? { email: data.email || null } : {}),
        ...(has("fechaNacimiento") ? { birthDate: birth } : {}),
        ...(has("genero") ? { gender: data.genero || null } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        entity: "Persona",
        entityId: dni,
        details: cambios.map((c) => `${c.campo}: ${c.antes || "sin dato"} → ${c.despues || "sin dato"}`).join("\n"),
      },
    });
  });

  if (padron && addressChanged) {
    let ubicacion: RelocateResult;
    try {
      ubicacion = await relocateAfterAddressChange(dni);
    } catch (err) {
      console.error("No se pudo ubicar la dirección nueva:", err);
      ubicacion = "PENDIENTE";
    }
    return { cambios, ubicacion };
  }
  return { cambios };
}

export interface PersonDataChangeEntry {
  id: string;
  fecha: string;
  usuario: string | null;
  cambios: string[];
}

/** Cambios de datos de la persona, para su Historia (los más recientes primero). */
export async function getPersonDataChanges(dni: string, take = 30): Promise<PersonDataChangeEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "Persona", entityId: dni, action: "UPDATE" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true, details: true, user: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    fecha: l.createdAt.toISOString(),
    usuario: l.user?.name || null,
    cambios: (l.details || "").split("\n").filter(Boolean),
  }));
}

/**
 * "Cargar persona": la suma al padrón (para que aparezca en el Registro Único, los filtros y el mapa)
 * y al Registro Único, y busca su dirección en el mapa. Quien llama controla antes que el DNI no exista.
 * Es "create" y no "upsert": si el DNI ya existe falla con P2002 y no pisa los datos de nadie.
 */
export async function createPersonRecord(dni: string, data: PersonDataFields): Promise<{ id: string; ubicacion: RelocateResult }> {
  const birth = data.fechaNacimiento ? new Date(`${data.fechaNacimiento}T12:00:00Z`) : null;
  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        id: dni,
        dni,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: birth,
        gender: data.genero || null,
        address: fullAddress(data) || null,
        phone: data.telefono || null,
        email: data.email || null,
      },
    });
    await tx.padronUnificado.create({
      data: {
        dni,
        nombre_completo: `${data.lastName}, ${data.firstName}`,
        direccion: data.direccion || null,
        barrio: data.barrio || null,
        localidad: data.localidad || null,
        telefono: data.telefono || null,
        email: data.email || null,
        fecha_nacimiento: data.fechaNacimiento ? fechaIsoATexto(data.fechaNacimiento) : null,
        genero: data.genero || null,
        cantidad_programas: 0,
      },
    });
    return created;
  });

  let ubicacion: RelocateResult;
  try {
    ubicacion = await relocateAfterAddressChange(dni);
  } catch (err) {
    console.error("No se pudo ubicar la dirección de la persona nueva:", err);
    ubicacion = "PENDIENTE";
  }
  return { id: person.id, ubicacion };
}
