import prisma from "@/lib/prisma";

export function normalizeCuit(cuit?: string | null): string {
  return (cuit || "").replace(/[^0-9]/g, "");
}

export function formatCuit(cuit?: string | null): string {
  const digits = normalizeCuit(cuit);
  if (digits.length !== 11) return cuit || "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

type OrderSummary = { count: number; executed: number; lastDate: Date | null };

// Las órdenes guardan el proveedor como texto (nombre y CUIT) y a veces también con providerId,
// así que se agrupan por ambos para no perder historial.
async function getOrdersByProvider() {
  const orders = await prisma.purchaseOrder.findMany({
    select: { providerId: true, providerCuit: true, providerName: true, amount: true, status: true, createdAt: true },
  });

  const byId = new Map<string, OrderSummary>();
  const byCuit = new Map<string, OrderSummary & { name: string; rawCuit: string }>();

  const add = (summary: OrderSummary, o: (typeof orders)[number]) => {
    summary.count += 1;
    if (o.status === "APROBADA" || o.status === "CUMPLIDA") summary.executed += Number(o.amount || 0);
    if (!summary.lastDate || o.createdAt > summary.lastDate) summary.lastDate = o.createdAt;
  };

  for (const o of orders) {
    if (o.providerId) {
      const s = byId.get(o.providerId) || { count: 0, executed: 0, lastDate: null };
      add(s, o);
      byId.set(o.providerId, s);
    } else {
      const cuit = normalizeCuit(o.providerCuit);
      if (!cuit) continue;
      const s = byCuit.get(cuit) || { count: 0, executed: 0, lastDate: null, name: o.providerName || "", rawCuit: o.providerCuit || "" };
      add(s, o);
      byCuit.set(cuit, s);
    }
  }
  return { byId, byCuit };
}

export async function getProvidersOverview(search?: string) {
  const q = (search || "").trim();
  const [providers, { byId, byCuit }] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    getOrdersByProvider(),
  ]);

  const registeredCuits = new Set(providers.map((p) => normalizeCuit(p.cuit)));

  const rows = providers.map((p) => {
    const fromId = byId.get(p.id);
    const fromCuit = byCuit.get(normalizeCuit(p.cuit));
    const lastDates = [fromId?.lastDate, fromCuit?.lastDate].filter(Boolean) as Date[];
    return {
      ...p,
      orderCount: (fromId?.count || 0) + (fromCuit?.count || 0),
      executed: (fromId?.executed || 0) + (fromCuit?.executed || 0),
      lastOrderDate: lastDates.length ? new Date(Math.max(...lastDates.map((d) => d.getTime()))) : null,
    };
  });

  const qDigits = normalizeCuit(q);
  const filtered = q
    ? rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (qDigits && normalizeCuit(p.cuit).includes(qDigits)))
    : rows;

  // Proveedores que aparecen en órdenes de compra pero todavía no están dados de alta.
  const unregistered = Array.from(byCuit.entries())
    .filter(([cuit]) => !registeredCuits.has(cuit))
    .map(([cuit, s]) => ({ cuit, name: s.name, orderCount: s.count, executed: s.executed }))
    .sort((a, b) => b.orderCount - a.orderCount);

  return { providers: filtered, total: rows.length, unregistered };
}

export async function getProviderDetail(id: string) {
  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider) return null;

  const cuit = normalizeCuit(provider.cuit);
  const candidates = await prisma.purchaseOrder.findMany({
    where: { OR: [{ providerId: id }, { providerId: null, providerCuit: { not: null } }] },
    include: { area: true },
    orderBy: { createdAt: "desc" },
  });
  const orders = candidates.filter((o) => o.providerId === id || normalizeCuit(o.providerCuit) === cuit);

  return { provider, orders };
}
