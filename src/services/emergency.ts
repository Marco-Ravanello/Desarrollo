import { prisma } from "@/lib/prisma";
import {
  EmergencyOperatorInfo,
  EmergencyStockItem,
  StormVictimItem,
  EmergencyOperationsData,
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
    const supplies = await prisma.supplyItem.findMany({
      include: { area: true }
    });

    const records = await getStormVictimRecords();

    const demandMap = {
      COLCHON: records.reduce((acc, r) => acc + (r.cantidadColchon || 0), 0),
      CAMA: records.reduce((acc, r) => acc + (r.cantidadCama || 0), 0),
      CUCHETA: records.reduce((acc, r) => acc + (r.cantidadCucheta || 0), 0),
      FRAZADA: records.reduce((acc, r) => acc + (r.cantidadFrazada || 0), 0),
    };

    const categorizedItems: EmergencyStockItem[] = [];

    const keyCategories: Array<{ key: "COLCHON" | "CAMA" | "CUCHETA" | "FRAZADA"; searchNames: string[]; defaultName: string; unit: string; minStock: number; defaultAvailable: number }> = [
      { key: "COLCHON", searchNames: ["colchon", "colchón"], defaultName: "Colchones de Contingencia (1 plaza)", unit: "Unidades", minStock: 50, defaultAvailable: 120 },
      { key: "CAMA", searchNames: ["cama"], defaultName: "Camas / Elasticos de Emergencia", unit: "Unidades", minStock: 20, defaultAvailable: 45 },
      { key: "CUCHETA", searchNames: ["cucheta"], defaultName: "Cuchetas Superpuestas Reforzadas", unit: "Unidades", minStock: 15, defaultAvailable: 30 },
      { key: "FRAZADA", searchNames: ["frazada", "manta"], defaultName: "Frazadas Térmicas Antialérgicas", unit: "Unidades", minStock: 100, defaultAvailable: 250 },
    ];

    for (const cat of keyCategories) {
      const match = supplies.find(s => cat.searchNames.some(sn => s.name.toLowerCase().includes(sn)));
      const available = match ? match.stock : cat.defaultAvailable;
      const minStock = match ? match.minStock : cat.minStock;
      const demanded = demandMap[cat.key] || 0;

      let status: "CRITICO" | "CORRECTO" | "EXCESO" = "CORRECTO";
      if (available < demanded || available < minStock) {
        status = "CRITICO";
      } else if (available > minStock * 3) {
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

    const generalSupplies = supplies.filter(s => {
      const lower = s.name.toLowerCase();
      return !["colchon", "colchón", "cama", "cucheta", "frazada", "manta"].some(kw => lower.includes(kw));
    });

    for (const gs of generalSupplies) {
      let status: "CRITICO" | "CORRECTO" | "EXCESO" = "CORRECTO";
      if (gs.stock <= gs.minStock) status = "CRITICO";

      categorizedItems.push({
        id: gs.id,
        name: gs.name,
        description: gs.description,
        category: "GENERAL",
        availableStock: gs.stock,
        minStock: gs.minStock,
        demandedQuantity: 0,
        unit: "Unidades",
        status,
        areaName: gs.area?.name || "Depósito Central",
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
    const records = await prisma.stormVictimRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    for (const r of records) {
      const item: StormVictimItem = {
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

      let nombre = c.person ? `${c.person.lastName}, ${c.firstName || c.person.firstName}` : "";
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

export async function getEmergencyOperationsData(sessionUser: any): Promise<EmergencyOperationsData> {
  const operator = await getEmergencyOperator(sessionUser);
  const stock = await getEmergencyStock();
  const records = await getStormVictimRecords();

  const totalVictims = records.length;
  const totalChildren = records.reduce((acc, r) => acc + (parseInt(r.ninos || "0") || 0), 0);
  const totalColchones = records.reduce((acc, r) => acc + (r.cantidadColchon || 0), 0);
  const totalCamas = records.reduce((acc, r) => acc + (r.cantidadCama || 0), 0);
  const totalCuchetas = records.reduce((acc, r) => acc + (r.cantidadCucheta || 0), 0);
  const totalFrazadas = records.reduce((acc, r) => acc + (r.cantidadFrazada || 0), 0);
  const highPriorityCount = records.filter(r => r.prioridad === "ALTA").length;

  return {
    operator,
    stock,
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

export async function syncPersonInDatabase(data: {
  dni: string;
  nombreApellido: string;
  domicilio?: string;
  contacto?: string;
}): Promise<string> {
  const cleanDni = data.dni.replace(/\D/g, "") || `TEMP-${Date.now()}`;

  let firstName = data.nombreApellido;
  let lastName = "";

  if (data.nombreApellido.includes(",")) {
    const parts = data.nombreApellido.split(",");
    lastName = parts[0].trim();
    firstName = parts[1].trim();
  } else if (data.nombreApellido.includes(" ")) {
    const parts = data.nombreApellido.trim().split(" ");
    lastName = parts.pop() || "";
    firstName = parts.join(" ");
  }

  try {
    const existing = await prisma.person.findUnique({
      where: { dni: cleanDni }
    });

    if (existing) {
      await prisma.person.update({
        where: { id: existing.id },
        data: {
          address: data.domicilio || existing.address,
          phone: data.contacto || existing.phone,
        }
      });
      return existing.id;
    }

    const created = await prisma.person.create({
      data: {
        dni: cleanDni,
        firstName: firstName || "Vecino",
        lastName: lastName || "Registrado",
        address: data.domicilio || "Tres de Febrero",
        phone: data.contacto || "",
      }
    });

    return created.id;
  } catch (err) {
    console.error("Error syncing person in DB:", err);
    return cleanDni;
  }
}
