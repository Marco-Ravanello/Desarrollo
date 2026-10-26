import type { Priority, Prisma, Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isEligibleAssignee } from "@/lib/case-assignment";
import { summarizeCase } from "@/lib/case-summary";
import { sortByLoad, type WorkloadMember } from "@/lib/team-workload";
import { dashboardCaseWhere, staleCaseWhere, type DashboardScope } from "@/services/dashboard";

// Carga del equipo de un área: cuántos expedientes tiene cada profesional y cuáles esperan a alguien.

const TEAM_ROLES: Role[] = ["DIRECTOR_AREA", "OPERATIVO", "VIOLENCIA_GENERO"];
const RECENT_DAYS = 7;
export const UNASSIGNED_LIST_LIMIT = 30;

export type Totals = { open: number; urgent: number; stale: number };

export type UnassignedCase = {
  id: string;
  title: string;
  titular: string | null;
  priority: Priority;
  openDays: number;
  quietDays: number;
};

type Scope = DashboardScope & { areaId: string };

export async function getTeamWorkload(scope: Scope, now = new Date()) {
  const area = await prisma.area.findUnique({ where: { id: scope.areaId }, select: { id: true, name: true } });
  if (!area) return null;

  const notClosed: Prisma.CaseWhereInput = { ...dashboardCaseWhere(scope), status: { not: "CERRADO" } };
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const [members, open, urgent, stale, recent] = await Promise.all([
    prisma.user.findMany({
      where: { areaId: area.id, isActive: true, role: { in: TEAM_ROLES } },
      select: { id: true, name: true, username: true, role: true, areaId: true, isActive: true },
    }),
    prisma.case.groupBy({ by: ["assignedToId"], where: notClosed, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["assignedToId"], where: { ...notClosed, priority: "URGENTE" }, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["assignedToId"], where: staleCaseWhere(scope, now), _count: { _all: true } }),
    prisma.case.groupBy({ by: ["assignedToId"], where: { ...notClosed, assignedAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const count = (rows: { assignedToId: string | null; _count: { _all: number } }[], id: string | null) =>
    rows.find((r) => r.assignedToId === id)?._count._all ?? 0;

  // Quien tiene expedientes del área a cargo aunque sea de otra área (por ejemplo, la conducción).
  const extraIds = open.map((r) => r.assignedToId).filter((id): id is string => Boolean(id) && !members.some((m) => m.id === id));
  const extra = extraIds.length
    ? await prisma.user.findMany({
        where: { id: { in: extraIds } },
        select: { id: true, name: true, username: true, role: true, areaId: true, isActive: true },
      })
    : [];

  const rows: WorkloadMember[] = [...members, ...extra].map((u) => ({
    userId: u.id,
    name: u.name || u.username || "Sin nombre",
    role: u.role,
    member: members.some((m) => m.id === u.id),
    eligible: isEligibleAssignee(u, { areaId: area.id, areaName: area.name }),
    open: count(open, u.id),
    urgent: count(urgent, u.id),
    stale: count(stale, u.id),
    recent: count(recent, u.id),
  }));

  const total = (rows: { _count: { _all: number } }[]) => rows.reduce((a, r) => a + r._count._all, 0);
  return {
    area,
    rows: sortByLoad(rows),
    unassigned: { open: count(open, null), urgent: count(urgent, null), stale: count(stale, null) } satisfies Totals,
    totals: { open: total(open), urgent: total(urgent), stale: total(stale) } satisfies Totals,
  };
}

/** Expedientes del área sin profesional a cargo: primero los urgentes y, entre iguales, los más viejos. */
export async function getUnassignedCases(scope: Scope, limit = UNASSIGNED_LIST_LIMIT, now = new Date()): Promise<UnassignedCase[]> {
  const cases = await prisma.case.findMany({
    where: { ...dashboardCaseWhere(scope), status: { not: "CERRADO" }, assignedToId: null },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      person: { select: { firstName: true, lastName: true } },
      interventions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
  return cases.map((c) => {
    const summary = summarizeCase({ status: c.status, createdAt: c.createdAt, lastInterventionAt: c.interventions[0]?.date ?? null, now });
    return {
      id: c.id,
      title: c.title,
      titular: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
      priority: c.priority,
      openDays: summary.openDays,
      quietDays: summary.quietDays,
    };
  });
}

/** Cuántos expedientes abiertos tiene cada persona (para mostrarlo al elegir a quién asignar). */
export async function countOpenCasesByUser(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.case.groupBy({
    by: ["assignedToId"],
    where: { assignedToId: { in: userIds }, status: { not: "CERRADO" } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.assignedToId as string, r._count._all]));
}
