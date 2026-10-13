import prisma from "@/lib/prisma";

const TZ = "America/Argentina/Buenos_Aires";
const EXECUTED = ["APROBADA", "CUMPLIDA"];

export type ReportPeriod = { from: Date; to: Date; fromStr: string; toStr: string };

const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const monthKey = (d: Date) => isoDay(d).slice(0, 7);

// Período por defecto: desde el 1° de enero del año en curso hasta hoy (hora de Argentina).
export function parseReportPeriod(desde?: string, hasta?: string): ReportPeriod {
  const today = isoDay(new Date());
  const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  let fromStr = valid(desde) || `${today.slice(0, 4)}-01-01`;
  let toStr = valid(hasta) || today;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
  return {
    from: new Date(`${fromStr}T00:00:00-03:00`),
    to: new Date(`${toStr}T23:59:59.999-03:00`),
    fromStr,
    toStr,
  };
}

function monthsBetween(fromStr: string, toStr: string) {
  const months: string[] = [];
  let [y, m] = fromStr.slice(0, 7).split("-").map(Number);
  const end = toStr.slice(0, 7);
  while (`${y}-${String(m).padStart(2, "0")}` <= end && months.length < 120) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

export async function getReportData(period: ReportPeriod) {
  const range = { gte: period.from, lte: period.to };
  const [areas, cases, interventions, orders] = await Promise.all([
    prisma.area.findMany({ select: { id: true, name: true, annualBudget: true }, orderBy: { name: "asc" } }),
    prisma.case.findMany({ where: { createdAt: range }, select: { areaId: true, status: true, priority: true, createdAt: true } }),
    prisma.intervention.findMany({ where: { date: range }, select: { date: true, case: { select: { areaId: true } } } }),
    prisma.purchaseOrder.findMany({
      where: { createdAt: range },
      select: {
        amount: true, status: true, areaId: true, providerId: true, providerName: true, providerCuit: true,
        provider: { select: { name: true, cuit: true } },
      },
    }),
  ]);

  const byArea = new Map(
    areas.map((a) => [a.id, {
      area: a.name, annualBudget: Number(a.annualBudget), cases: 0, closed: 0, urgent: 0,
      interventions: 0, orders: 0, executed: 0,
    }]),
  );

  const caseStatus = new Map<string, number>();
  for (const c of cases) {
    caseStatus.set(c.status, (caseStatus.get(c.status) || 0) + 1);
    const row = byArea.get(c.areaId);
    if (!row) continue;
    row.cases += 1;
    if (c.status === "CERRADO") row.closed += 1;
    if (c.priority === "URGENTE") row.urgent += 1;
  }
  for (const i of interventions) {
    const row = byArea.get(i.case.areaId);
    if (row) row.interventions += 1;
  }

  const orderStatus = new Map<string, { count: number; amount: number }>();
  const providers = new Map<string, { name: string; cuit: string; orders: number; executed: number }>();
  let executedTotal = 0;
  let unassignedExecuted = 0;
  for (const o of orders) {
    const amount = Number(o.amount || 0);
    const s = orderStatus.get(o.status) || { count: 0, amount: 0 };
    s.count += 1;
    s.amount += amount;
    orderStatus.set(o.status, s);

    const isExecuted = EXECUTED.includes(o.status);
    if (isExecuted) executedTotal += amount;
    const row = o.areaId ? byArea.get(o.areaId) : undefined;
    if (row) {
      row.orders += 1;
      if (isExecuted) row.executed += amount;
    } else if (isExecuted) {
      unassignedExecuted += amount;
    }

    const cuit = (o.provider?.cuit || o.providerCuit || "").replace(/[^0-9]/g, "");
    const key = cuit || o.providerId || (o.providerName || "").trim().toUpperCase();
    if (!key) continue;
    const p = providers.get(key) || { name: o.provider?.name || o.providerName || "Sin nombre", cuit: o.provider?.cuit || o.providerCuit || "", orders: 0, executed: 0 };
    p.orders += 1;
    if (isExecuted) p.executed += amount;
    providers.set(key, p);
  }

  const months = monthsBetween(period.fromStr, period.toStr);
  const trend = new Map(months.map((m) => [m, { month: m, expedientes: 0, intervenciones: 0 }]));
  for (const c of cases) { const t = trend.get(monthKey(c.createdAt)); if (t) t.expedientes += 1; }
  for (const i of interventions) { const t = trend.get(monthKey(i.date)); if (t) t.intervenciones += 1; }

  return {
    totals: {
      cases: cases.length,
      urgent: cases.filter((c) => c.priority === "URGENTE").length,
      interventions: interventions.length,
      orders: orders.length,
      executed: executedTotal,
      unassignedExecuted,
    },
    areas: Array.from(byArea.values()),
    caseStatus: Array.from(caseStatus.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    orderStatus: Array.from(orderStatus.entries()).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.amount - a.amount),
    topProviders: Array.from(providers.values()).sort((a, b) => b.executed - a.executed || b.orders - a.orders).slice(0, 10),
    trend: Array.from(trend.values()),
  };
}
