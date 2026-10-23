import prisma from "@/lib/prisma";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { splitCaseTitle } from "@/lib/case-summary";

// Títulos de la pestaña del navegador para las páginas de detalle: el nombre de lo que se está viendo,
// así con varias pestañas abiertas se distinguen. Si algo falla, queda el título genérico.

type Params = { params: Promise<{ id: string }> };

async function safe(generic: string, load: () => Promise<string | null | undefined>) {
  try {
    const name = (await load())?.trim();
    return { title: name ? `${name} · ${generic}` : generic };
  } catch {
    return { title: generic };
  }
}

/** Expediente: el titular o la carátula. Los de Violencia de Género quedan con el título genérico. */
export async function caseTitle({ params }: Params) {
  const id = decodeURIComponent((await params).id || "");
  return safe("Expediente", async () => {
    const c = await prisma.case.findUnique({
      where: { id },
      select: { title: true, area: { select: { name: true } }, person: { select: { lastName: true, firstName: true } } },
    });
    if (!c || isSensitiveArea(c.area?.name)) return null;
    return c.person ? `${c.person.lastName}, ${c.person.firstName}` : splitCaseTitle(c.title).title;
  });
}

/** Persona: su nombre (el padrón por DNI, o el registro de la app). */
export async function personTitle({ params }: Params) {
  const id = decodeURIComponent((await params).id || "");
  return safe("Persona", async () => {
    const rows = await prisma.$queryRaw<{ nombre_completo: string | null }[]>`SELECT nombre_completo FROM padron_unificado WHERE dni = ${id} LIMIT 1`;
    if (rows[0]?.nombre_completo) return rows[0].nombre_completo;
    const p = await prisma.person.findFirst({ where: { OR: [{ id }, { dni: id }] }, select: { lastName: true, firstName: true } });
    return p ? `${p.lastName}, ${p.firstName}` : null;
  });
}

export async function purchaseOrderTitle({ params }: Params) {
  const { id } = await params;
  return safe("Orden de compra", async () => {
    const o = await prisma.purchaseOrder.findUnique({ where: { id }, select: { number: true } });
    return o ? `N° ${o.number}` : null;
  });
}

export async function providerTitle({ params }: Params) {
  const { id } = await params;
  return safe("Proveedor", async () => (await prisma.provider.findUnique({ where: { id }, select: { name: true } }))?.name);
}

export async function vehicleTitle({ params }: Params) {
  const { id } = await params;
  return safe("Vehículo", async () => {
    const v = await prisma.vehicle.findUnique({ where: { id }, select: { brand: true, model: true, plate: true } });
    return v ? `${v.brand} ${v.model} (${v.plate})` : null;
  });
}

export async function agreementTitle({ params }: Params) {
  const { id } = await params;
  return safe("Convenio", async () => (await prisma.agreement.findUnique({ where: { id }, select: { title: true } }))?.title);
}
