import { prisma } from "@/lib/prisma";
import { normalizeDni } from "@/lib/padron-import";
import { canEditSocialRecords, canManageEmergencyStock, isEmergencySurveyor } from "@/lib/permissions";
import { isDeliveryTableReady, stormRecordOmit } from "@/services/emergency-db-status";
import { getCategoryLinks, getEmergencyExtraItems } from "@/services/emergency-stock-links";
import { EMERGENCY_CATEGORIES, EmergencyCategoryKey, cleanItemQuantities, findCategorySupply, pendingByCategory, pendingExtras } from "@/lib/emergency-categories";

export { EMERGENCY_CATEGORIES, findCategorySupply, pendingByCategory };
export type { EmergencyCategoryKey };
import {
  EmergencyPriority,
  EmergencyOperatorInfo,
  EmergencyStockItem,
  StormVictimItem,
  EmergencyOperationsData,
  EmergencyExtraItem,
  SearchPersonSuggestion
} from "@/types/emergency";

export async function getEmergencyOperator(sessionUser: any): Promise<EmergencyOperatorInfo> {
  const fallback: EmergencyOperatorInfo = {
    userId: sessionUser?.id || "cl-op-001",
    name: sessionUser?.name || sessionUser?.email?.split("@")[0] || "Operador Guardia COE",
    email: sessionUser?.email || "guardia@tresdefebrero.gob.ar",
    areaId: sessionUser?.areaId || "cl-area-emergencia",
    areaName: "Desarrollo Humano - Contingencia Climática",
  };

  if (!sessionUser?.id) {
    return fallback;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { area: true }
    });

    if (user) {
      return {
        userId: user.id,
        name: user.name || sessionUser.name || "Operador COE",
        email: user.email || sessionUser.email || "",
        areaId: user.areaId || fallback.areaId,
        areaName: user.area?.name || fallback.areaName,
      };
    }
  } catch (err) {
    console.error("Error fetching emergency operator user from DB:", err);
  }

  return fallback;
}

export async function getEmergencyStock(): Promise<EmergencyStockItem[]> {
  try {
    const [supplies, records, links, extraItems] = await Promise.all([
      prisma.supplyItem.findMany({ include: { area: true } }),
      getStormVictimRecords(),
      getCategoryLinks(),
      getEmergencyExtraItems(),
    ]);

    // Demanda = lo que falta entregar de las fichas.
    const demandMap: Record<EmergencyCategoryKey, number> = { COLCHON: 0, CAMA: 0, CUCHETA: 0, FRAZADA: 0 };
    const extraDemand = new Map<string, number>();
    for (const r of records) {
      const pending = pendingByCategory(r);
      for (const key of Object.keys(demandMap) as EmergencyCategoryKey[]) demandMap[key] += pending[key];
      for (const [id, n] of Object.entries(pendingExtras(r))) extraDemand.set(id, (extraDemand.get(id) || 0) + n);
    }

    const categorizedItems: EmergencyStockItem[] = [];

    let overrides: Record<string, number> = {};
    try {
      const overrideSetting = await prisma.systemSetting.findUnique({
        where: { key: "muni-emergency-stock-overrides" },
      });
      if (overrideSetting?.value) {
        overrides = JSON.parse(overrideSetting.value);
      }
    } catch (e) {
      console.warn("Could not read stock overrides setting:", e);
    }

    const categoryItemIds = new Set<string>();
    for (const cat of EMERGENCY_CATEGORIES) {
      const match = findCategorySupply(supplies, cat.key, links);
      if (match) categoryItemIds.add(match.id);

      // El stock real es el del insumo del depósito (lo que descuentan las entregas).
      // El ajuste manual guardado aparte solo se usa si todavía no existe el insumo.
      let available = 0;
      if (match) {
        available = match.stock;
      } else if (overrides[cat.key] !== undefined) {
        available = Number(overrides[cat.key]) || 0;
      }

      const minStock = match ? match.minStock : cat.minStock;
      const demanded = demandMap[cat.key] || 0;

      let status: "CRITICO" | "CORRECTO" | "EXCESO" = "CORRECTO";
      if (available < demanded || (available < minStock && available > 0)) {
        status = "CRITICO";
      } else if (available === 0 && demanded > 0) {
        status = "CRITICO";
      } else if (available > minStock * 3 && available > 0) {
        status = "EXCESO";
      }

      categorizedItems.push({
        id: match ? match.id : `stock-cat-${cat.key.toLowerCase()}`,
        name: match ? match.name : cat.defaultName,
        description: match ? match.description : `Insumo crítico de contingencia`,
        category: cat.key,
        availableStock: available,
        minStock,
        demandedQuantity: demanded,
        unit: cat.unit,
        status,
        areaName: match?.area?.name || "Depósito Desarrollo Humano",
      });
    }

    // Insumos agregados desde Emergencia (chapas, nylon...): van junto a los de las fichas.
    const extraById = new Map(extraItems.filter((ci) => ci?.id).map((ci) => [String(ci.id), ci]));

    const otherSupplies = supplies.filter(s => {
      if (categoryItemIds.has(s.id)) return false;
      if (extraById.has(s.id)) return true;
      const lower = s.name.toLowerCase();
      return !["colchon", "colchón", "cama", "cucheta", "frazada", "manta"].some(kw => lower.includes(kw));
    });

    for (const gs of otherSupplies) {
      const extra = extraById.get(gs.id);
      const demanded = extra ? extraDemand.get(gs.id) || 0 : 0;
      let status: "CRITICO" | "CORRECTO" | "EXCESO" = "CORRECTO";
      if (gs.stock <= gs.minStock || gs.stock < demanded) status = "CRITICO";

      categorizedItems.push({
        id: gs.id,
        name: gs.name,
        description: gs.description,
        category: extra ? "ADICIONAL" : "GENERAL",
        availableStock: gs.stock,
        minStock: gs.minStock,
        demandedQuantity: demanded,
        unit: extra?.unit || "Unidades",
        status,
        areaName: gs.area?.name || (extra ? "Depósito Desarrollo Humano" : "Depósito Central"),
      });
    }

    // Insumos agregados desde Emergencia que no llegaron a guardarse en el depósito.
    for (const ci of extraItems) {
      if (!ci?.id || categorizedItems.some(i => i.id === ci.id)) continue;
      const availableStock = Number(ci.availableStock) || 0;
      const minStock = Number(ci.minStock) || 5;
      const demanded = extraDemand.get(ci.id) || 0;
      categorizedItems.push({
        id: ci.id,
        name: ci.name,
        description: ci.description || "Insumo de contingencia",
        category: "ADICIONAL",
        availableStock,
        minStock,
        demandedQuantity: demanded,
        unit: ci.unit || "Unidades",
        status: availableStock <= minStock || availableStock < demanded ? "CRITICO" : "CORRECTO",
        areaName: "Depósito Desarrollo Humano",
      });
    }

    return categorizedItems;
  } catch (err) {
    console.error("Error loading emergency stock:", err);
    return [];
  }
}

function parseQuantityFromText(text: string, kw: string): { required: boolean; qty: number } {
  const regex = new RegExp(`(\\d+)\\s+${kw}`, "i");
  const match = text.match(regex);
  if (match && match[1]) {
    const qty = parseInt(match[1], 10);
    return { required: qty > 0, qty };
  }
  return { required: false, qty: 0 };
}

export async function getStormVictimRecords(): Promise<StormVictimItem[]> {
  const mergedMap = new Map<string, StormVictimItem>();

  // 1. Cargar desde StormVictimRecord si existe la tabla
  try {
    const withDeliveries = await isDeliveryTableReady();
    const records = await prisma.stormVictimRecord.findMany({
      orderBy: { createdAt: "desc" },
      omit: await stormRecordOmit(),
      include: withDeliveries ? { entregas: true } : undefined,
    });

    for (const r of records) {
      const item: StormVictimItem = {
        ...deliveryTotals((r as any).entregas),
        fromTable: true,
        id: r.id,
        itemNumber: r.itemNumber,
        personId: r.personId,
        nombreApellido: r.nombreApellido,
        dni: r.dni,
        edad: r.edad,
        grupoFamiliar: r.grupoFamiliar,
        ninos: r.ninos,
        domicilio: r.domicilio,
        referencia: r.referencia,
        barrio: r.barrio,
        requiereColchon: r.requiereColchon,
        cantidadColchon: r.cantidadColchon,
        requiereCama: r.requiereCama,
        cantidadCama: r.cantidadCama,
        requiereCucheta: r.requiereCucheta,
        cantidadCucheta: r.cantidadCucheta,
        requiereFrazada: r.requiereFrazada,
        cantidadFrazada: r.cantidadFrazada,
        otrosElementos: cleanItemQuantities((r as any).otrosElementos),
        observaciones: r.observaciones,
        contacto: r.contacto,
        agentes: r.agentes,
        prioridad: (r.prioridad as any) || "MEDIA",
        descripcionIntervencion: r.descripcionIntervencion,
        estado: r.estado,
        caseId: r.caseId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };

      const key = r.caseId || r.id;
      mergedMap.set(key, item);
    }
  } catch (err) {
    console.warn("Notice: StormVictimRecord table not directly readable, proceeding to Cases query:", err);
  }

  // 2. Cargar desde Backup en SystemSetting
  try {
    const fallbackSetting = await prisma.systemSetting.findUnique({
      where: { key: "muni-storm-records-backup" },
    });

    if (fallbackSetting?.value) {
      const parsed: StormVictimItem[] = JSON.parse(fallbackSetting.value);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const key = item.caseId || item.id;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Notice: Could not read backup setting:", err);
  }

  // 3. Cargar desde prisma.case (Cruzar casos de contingencia/tormenta)
  try {
    const stormCases = await prisma.case.findMany({
      where: {
        OR: [
          { title: { contains: "TORMENTA", mode: "insensitive" } },
          { title: { contains: "EMERGENCIA", mode: "insensitive" } },
          { title: { contains: "CLIMÁTICA", mode: "insensitive" } },
          { title: { contains: "CONTINGENCIA", mode: "insensitive" } },
          { description: { contains: "TORMENTA", mode: "insensitive" } },
          { description: { contains: "CONTINGENCIA", mode: "insensitive" } },
        ],
      },
      include: {
        person: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const c of stormCases) {
      if (mergedMap.has(c.id)) {
        continue;
      }

      const desc = c.description || "";
      const colchon = parseQuantityFromText(desc, "colch");
      const cama = parseQuantityFromText(desc, "cama");
      const cucheta = parseQuantityFromText(desc, "cucheta");
      const frazada = parseQuantityFromText(desc, "frazada|manta");

      const hasGrupoFam = /Grupo Familiar:\s*S[íi]/i.test(desc);
      const ninosMatch = desc.match(/Niños:\s*(\d+)/i);
      const ninosStr = ninosMatch ? ninosMatch[1] : "0";

      const domMatch = desc.match(/Domicilio:\s*([^.(]+)/i);
      const refMatch = desc.match(/\(Ref:\s*([^)]+)\)/i);

      let nombre = c.person ? `${c.person.lastName}, ${c.person.firstName}` : "";
      if (!nombre && c.person) {
        nombre = `${c.person.lastName}, ${c.person.firstName}`;
      }
      if (!nombre) {
        const titleNameMatch = c.title.match(/Asistencia a\s+([^-]+)/i);
        nombre = titleNameMatch ? titleNameMatch[1].trim() : "Vecino Afectado";
      }

      const item: StormVictimItem = {
        id: `case-${c.id}`,
        itemNumber: mergedMap.size + 1,
        personId: c.personId,
        nombreApellido: nombre.toUpperCase(),
        dni: c.person?.dni || null,
        edad: null,
        grupoFamiliar: hasGrupoFam,
        ninos: ninosStr,
        domicilio: domMatch ? domMatch[1].trim() : (c.person?.address || "Tres de Febrero"),
        referencia: refMatch ? refMatch[1].trim() : null,
        barrio: null,
        requiereColchon: colchon.required,
        cantidadColchon: colchon.qty,
        requiereCama: cama.required,
        cantidadCama: cama.qty,
        requiereCucheta: cucheta.required,
        cantidadCucheta: cucheta.qty,
        requiereFrazada: frazada.required,
        cantidadFrazada: frazada.qty,
        observaciones: c.title,
        contacto: c.person?.phone || null,
        agentes: "Operador Guardia COE",
        prioridad: (c.priority as any) || "MEDIA",
        descripcionIntervencion: c.description || "",
        estado: c.status || "REGISTRADO",
        caseId: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };

      mergedMap.set(c.id, item);
    }
  } catch (err) {
    console.error("Error querying storm cases from prisma.case:", err);
  }

  return Array.from(mergedMap.values());
}

/** Totales entregados de una ficha a partir de sus entregas. */
function deliveryTotals(entregas?: { colchones: number; camas: number; cuchetas: number; frazadas: number; otrosElementos?: unknown; createdAt: Date }[]) {
  if (!entregas?.length) return { entregadoColchon: 0, entregadoCama: 0, entregadoCucheta: 0, entregadoFrazada: 0, entregadoOtros: {}, ultimaEntrega: null };
  const entregadoOtros: Record<string, number> = {};
  for (const e of entregas) {
    for (const [id, n] of Object.entries(cleanItemQuantities(e.otrosElementos))) entregadoOtros[id] = (entregadoOtros[id] || 0) + n;
  }
  return {
    entregadoOtros,
    entregadoColchon: entregas.reduce((a, e) => a + e.colchones, 0),
    entregadoCama: entregas.reduce((a, e) => a + e.camas, 0),
    entregadoCucheta: entregas.reduce((a, e) => a + e.cuchetas, 0),
    entregadoFrazada: entregas.reduce((a, e) => a + e.frazadas, 0),
    ultimaEntrega: entregas.reduce((last, e) => (e.createdAt > last ? e.createdAt : last), entregas[0].createdAt),
  };
}

/** Fichas cargadas por un usuario (lo único que ve el relevador de emergencia). */
export async function getStormVictimRecordsByUser(userId: string): Promise<StormVictimItem[]> {
  const withDeliveries = await isDeliveryTableReady();
  const records = await prisma.stormVictimRecord.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    include: withDeliveries ? { entregas: true } : undefined,
  });
  return records.map(({ entregas, ...r }: any) => ({
    ...r,
    otrosElementos: cleanItemQuantities(r.otrosElementos),
    ...deliveryTotals(entregas),
    fromTable: true,
    prioridad: (r.prioridad as EmergencyPriority) || "MEDIA",
  }));
}

/** Insumos agregados desde Emergencia que se pueden pedir en las fichas, con su nombre actual. */
export async function getEmergencyExtraItemOptions(): Promise<EmergencyExtraItem[]> {
  const extras = (await getEmergencyExtraItems()).filter((ci) => ci?.id && ci?.name);
  if (extras.length === 0) return [];
  const supplies = await prisma.supplyItem
    .findMany({ where: { id: { in: extras.map((ci) => String(ci.id)) } }, select: { id: true, name: true } })
    .catch(() => []);
  const names = new Map(supplies.map((s) => [s.id, s.name]));
  return extras
    .map((ci) => ({ id: String(ci.id), name: names.get(String(ci.id)) || String(ci.name), unit: ci.unit || "Unidades" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getEmergencyOperationsData(sessionUser: any): Promise<EmergencyOperationsData> {
  const operator = await getEmergencyOperator(sessionUser);
  const surveyor = isEmergencySurveyor(sessionUser?.role);

  // El relevador no ve el stock del depósito, solo lo que relevó.
  const [stock, records, extraItems] = await Promise.all([
    surveyor ? [] : getEmergencyStock(),
    surveyor ? (sessionUser?.id ? getStormVictimRecordsByUser(sessionUser.id) : []) : getStormVictimRecords(),
    getEmergencyExtraItemOptions(),
  ]);

  const totalVictims = records.length;
  const totalChildren = records.reduce((acc, r) => acc + (parseInt(r.ninos || "0") || 0), 0);
  const totalColchones = records.reduce((acc, r) => acc + (r.cantidadColchon || 0), 0);
  const totalCamas = records.reduce((acc, r) => acc + (r.cantidadCama || 0), 0);
  const totalCuchetas = records.reduce((acc, r) => acc + (r.cantidadCucheta || 0), 0);
  const totalFrazadas = records.reduce((acc, r) => acc + (r.cantidadFrazada || 0), 0);
  const highPriorityCount = records.filter(r => r.prioridad === "ALTA").length;

  return {
    operator,
    viewer: {
      onlyOwnRecords: surveyor,
      canViewStock: canManageEmergencyStock(sessionUser?.role),
      canDeliver: canManageEmergencyStock(sessionUser?.role),
      canEdit: canEditSocialRecords(sessionUser?.role),
    },
    stock,
    extraItems,
    records,
    metrics: {
      totalVictims,
      totalChildren,
      totalColchones,
      totalCamas,
      totalCuchetas,
      totalFrazadas,
      highPriorityCount,
    },
  };
}

export async function searchPeopleForEmergency(query: string): Promise<SearchPersonSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim();
  const suggestions: SearchPersonSuggestion[] = [];

  try {
    const persons = await prisma.person.findMany({
      where: {
        OR: [
          { dni: { contains: cleanQuery, mode: "insensitive" } },
          { firstName: { contains: cleanQuery, mode: "insensitive" } },
          { lastName: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      take: 5,
    });

    for (const p of persons) {
      suggestions.push({
        personId: p.id,
        nombreApellido: `${p.lastName}, ${p.firstName}`.toUpperCase(),
        dni: p.dni,
        domicilio: p.address || "",
        contacto: p.phone || p.email || "",
        grupoFamiliar: Boolean(p.familyId),
        source: "person",
      });
    }

    const rawPadron = await prisma.$queryRawUnsafe<any[]>(
      `SELECT dni, nombre_completo, direccion, barrio, telefono, dnis_familiares, nombres_familiares, edad_aprox
       FROM padron_unificado
       WHERE dni ILIKE $1 OR nombre_completo ILIKE $1
       LIMIT 5`,
      `%${cleanQuery}%`
    );

    for (const pad of rawPadron) {
      if (!suggestions.some(s => s.dni === pad.dni)) {
        const hasFamily = Boolean(pad.dnis_familiares || pad.nombres_familiares);
        suggestions.push({
          nombreApellido: (pad.nombre_completo || "").toUpperCase(),
          dni: pad.dni,
          domicilio: pad.direccion || "",
          barrio: pad.barrio || "",
          edad: pad.edad_aprox ? String(pad.edad_aprox) : "",
          contacto: pad.telefono || "",
          grupoFamiliar: hasFamily,
          source: "padron",
        });
      }
    }
  } catch (err) {
    console.error("Error searching people for emergency:", err);
  }

  return suggestions;
}

/** DNI provisorio de una persona cargada en una ficha sin DNI. */
export const isTempPersonDni = (dni: string | null | undefined) => Boolean(dni?.startsWith("TEMP-"));

/**
 * Pasa a `toId` los expedientes, intervenciones, fichas y documentos de una persona
 * cargada sin DNI (DNI provisorio) y la borra. No hace nada si `fromId` tiene un DNI real.
 */
export async function mergeTempPerson(fromId: string, toId: string): Promise<boolean> {
  if (fromId === toId) return false;
  const from = await prisma.person.findUnique({ where: { id: fromId }, select: { dni: true } });
  if (!from || !isTempPersonDni(from.dni)) return false;
  await prisma.$transaction([
    prisma.case.updateMany({ where: { personId: fromId }, data: { personId: toId } }),
    prisma.intervention.updateMany({ where: { personId: fromId }, data: { personId: toId } }),
    prisma.stormVictimRecord.updateMany({ where: { personId: fromId }, data: { personId: toId } }),
    prisma.document.updateMany({ where: { personId: fromId }, data: { personId: toId } }),
    prisma.person.delete({ where: { id: fromId } }),
  ]);
  return true;
}

function splitFullName(fullName: string) {
  let firstName = fullName;
  let lastName = "";
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    lastName = parts[0].trim();
    firstName = parts[1].trim();
  } else if (fullName.includes(" ")) {
    const parts = fullName.trim().split(" ");
    lastName = parts.pop() || "";
    firstName = parts.join(" ");
  }
  return { firstName: firstName || "Vecino", lastName: lastName || "Registrado" };
}

/**
 * Busca o crea la persona de una ficha de tormenta y devuelve su id.
 * - Sin DNI válido: se usa la persona que ya tenía la ficha (`previousPersonId`) o se crea una con DNI provisorio.
 * - Con DNI: si la ficha tenía una persona con DNI provisorio, se une con la de ese DNI
 *   (o se le pone el DNI si todavía no existe), así no quedan personas repetidas.
 */
export async function syncPersonInDatabase(data: {
  dni: string;
  nombreApellido: string;
  domicilio?: string;
  contacto?: string;
  previousPersonId?: string | null;
}): Promise<string> {
  const dni = normalizeDni(data.dni);
  const name = splitFullName(data.nombreApellido);

  try {
    const previous = data.previousPersonId
      ? await prisma.person.findUnique({ where: { id: data.previousPersonId } })
      : null;
    const previousTemp = previous && isTempPersonDni(previous.dni) ? previous : null;

    if (!dni) {
      if (previous) {
        await prisma.person.update({
          where: { id: previous.id },
          data: { address: data.domicilio || previous.address, phone: data.contacto || previous.phone },
        });
        return previous.id;
      }
      const created = await prisma.person.create({
        data: { dni: `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...name, address: data.domicilio || "Tres de Febrero", phone: data.contacto || "" },
      });
      return created.id;
    }

    const existing = await prisma.person.findUnique({ where: { dni } });

    if (existing) {
      await prisma.person.update({
        where: { id: existing.id },
        data: {
          address: data.domicilio || existing.address,
          phone: data.contacto || existing.phone,
        }
      });
      if (previousTemp) await mergeTempPerson(previousTemp.id, existing.id);
      return existing.id;
    }

    if (previousTemp) {
      await prisma.person.update({
        where: { id: previousTemp.id },
        data: { dni, ...name, address: data.domicilio || previousTemp.address, phone: data.contacto || previousTemp.phone },
      });
      return previousTemp.id;
    }

    const created = await prisma.person.create({
      data: {
        dni,
        ...name,
        address: data.domicilio || "Tres de Febrero",
        phone: data.contacto || "",
      }
    });

    return created.id;
  } catch (err) {
    console.error("Error syncing person in DB:", err);
    return dni || "";
  }
}
