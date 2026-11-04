export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canViewHR } from "@/lib/hr-labels";
import { diaAR } from "@/lib/fechas";
import { getAreaShortName } from "@/lib/area-theme";
import {
  LEAVE_KINDS, LEAVE_TONE_CLASS, leaveDays, leaveKindLabel, leaveKindShort, leaveKindTone, monthDays, monthFromParam, monthParam, shiftMonth, dateToDay,
} from "@/lib/hr-leaves";
import { WEEK_LETTERS } from "@/lib/hr-form";
import { getAbsencesForMonth, syncLeaveStatuses } from "@/services/hr-leaves";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { FilterForm } from "@/components/ui/filter-form";
import { filterSelectClass } from "@/components/ui/form-section";

export const metadata = { title: "Ausencias del mes" };

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const fmt = (d: Date) => dateToDay(d).split("-").reverse().join("/");

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<{ mes?: string; area?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canViewHR(session.user.role)) redirect("/dashboard");

  const { mes, area } = await searchParams;
  const today = diaAR();
  const { year, month } = monthFromParam(mes, today);
  const areaId = area && area !== "all" ? area : null;
  await syncLeaveStatuses().catch(() => 0);
  const [areas, rows] = await Promise.all([
    prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getAbsencesForMonth(year, month, areaId),
  ]);

  const days = monthDays(year, month);
  const isThisMonth = monthParam(year, month) === today.slice(0, 7);
  const todayNum = isThisMonth ? Number(today.slice(8, 10)) : null;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const link = (y: number, m: number) => `/admin/hr/ausencias?mes=${monthParam(y, m)}${areaId ? `&area=${areaId}` : ""}`;

  // Cuántos faltan cada día del mes, y cuántos días de ausencia suma el mes.
  const perDay = days.map((d) => rows.filter((r) => r.spans.some((s) => s.from <= d.day && s.to >= d.day)).length);
  const totalDays = rows.reduce((n, r) => n + r.spans.reduce((m, s) => m + (s.to - s.from + 1), 0), 0);
  const kindsShown = LEAVE_KINDS.filter((k) => rows.some((r) => r.spans.some((s) => s.kind === k.value)));
  const anyFromStatus = rows.some((r) => r.fromStatus);
  const cols = `minmax(9.5rem, 14rem) repeat(${days.length}, minmax(1.75rem, 1fr))`;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Recursos" },
          { label: "Recursos Humanos", href: "/admin/hr" },
          { label: "Ausencias del mes", active: true },
        ]}
      />
      <PageHeader title="Ausencias del mes" description="Quién está de licencia o de vacaciones cada día, por área." icon={CalendarRange} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="Mes anterior">
            <Link href={link(prev.year, prev.month)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="min-w-[10rem] text-center font-heading text-lg font-semibold text-foreground">
            {MONTHS[month - 1]} {year}
          </h2>
          <Button variant="outline" size="icon" asChild aria-label="Mes siguiente">
            <Link href={link(next.year, next.month)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {!isThisMonth && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={link(Number(today.slice(0, 4)), Number(today.slice(5, 7)))}>Este mes</Link>
          </Button>
        )}
        <FilterForm className="ml-auto w-full sm:w-64">
          <input type="hidden" name="mes" value={monthParam(year, month)} />
          <select name="area" aria-label="Área" defaultValue={areaId ?? "all"} className={filterSelectClass}>
            <option value="all">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {getAreaShortName(a.name)}
              </option>
            ))}
          </select>
        </FilterForm>
      </div>

      <StatRow>
        {todayNum !== null && (
          <StatCard label="Faltan hoy" value={String(perDay[todayNum - 1])} hint="De licencia o de vacaciones" icon={CalendarRange} tone="orange" />
        )}
        <StatCard label="Faltan en el mes" value={String(rows.length)} hint="Agentes con algún día de ausencia" icon={CalendarRange} tone="blue" />
        <StatCard label="Días de ausencia" value={String(totalDays)} hint="Suma de días corridos del mes" icon={CalendarRange} tone="purple" />
      </StatRow>

      {rows.length === 0 ? (
        <EmptyMessage
          kind="done"
          title={`Nadie falta en ${MONTHS[month - 1].toLowerCase()}`}
          description="Las licencias y vacaciones se cargan desde el legajo de cada agente."
          action={
            <Button variant="outline" asChild>
              <Link href="/admin/hr">Ir a Recursos Humanos</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[56rem]" role="table" aria-label={`Ausencias de ${MONTHS[month - 1]} ${year}`}>
              <div className="grid border-b border-border/60 bg-muted/30 text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: cols }} role="row">
                <div className="sticky left-0 z-20 bg-muted/90 px-3 py-2 text-left text-xs font-semibold text-foreground backdrop-blur" role="columnheader">
                  Agente
                </div>
                {days.map((d) => (
                  <div
                    key={d.day}
                    role="columnheader"
                    className={`py-1.5 ${d.weekend ? "bg-muted/60" : ""} ${d.day === todayNum ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    <span className="block font-medium">{WEEK_LETTERS[d.weekday]}</span>
                    <span className="block text-xs font-semibold tabular-nums">{d.day}</span>
                  </div>
                ))}
              </div>

              {rows.map((r) => (
                <div key={r.id} className="grid border-b border-border/40" style={{ gridTemplateColumns: cols }} role="row">
                  <div className="sticky left-0 z-20 min-w-0 bg-card px-3 py-2" style={{ gridRow: 1, gridColumn: 1 }} role="rowheader">
                    <Link href={`/admin/hr/${r.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline">
                      {r.name}
                      {r.fromStatus && <span className="text-amber-600" aria-label="sin fechas cargadas">*</span>}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{r.area ? getAreaShortName(r.area) : "Sin área"}</p>
                  </div>
                  {days.map((d) => (
                    <div
                      key={d.day}
                      aria-hidden
                      className={`border-l border-border/30 ${d.weekend ? "bg-muted/40" : ""} ${d.day === todayNum ? "bg-primary/10" : ""}`}
                      style={{ gridRow: 1, gridColumn: d.day + 1 }}
                    />
                  ))}
                  {r.spans.map((s) => {
                    const n = s.to - s.from + 1;
                    const title = `${leaveKindLabel(s.kind)}: del ${fmt(s.startDate)} al ${fmt(s.endDate)} (${leaveDays(s.startDate, s.endDate)} días)${s.notes ? `. ${s.notes}` : ""}`;
                    return (
                      <div
                        key={s.id}
                        role="cell"
                        title={title}
                        aria-label={title}
                        className={`z-10 mx-0.5 my-2 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] font-semibold ${LEAVE_TONE_CLASS[leaveKindTone(s.kind)].cell}`}
                        style={{ gridRow: 1, gridColumn: `${s.from + 1} / ${s.to + 2}` }}
                      >
                        {n >= 3 && <span className="truncate">{leaveKindShort(s.kind)}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="grid bg-muted/30 text-center text-xs" style={{ gridTemplateColumns: cols }} role="row">
                <div className="sticky left-0 z-20 bg-muted/90 px-3 py-2 text-left font-semibold text-foreground backdrop-blur" role="rowheader">
                  Faltan
                </div>
                {perDay.map((n, i) => (
                  <div key={i} role="cell" className={`py-2 font-semibold tabular-nums ${n ? "text-foreground" : "text-muted-foreground/50"}`}>
                    {n || "·"}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            {kindsShown.map((k) => (
              <span key={k.value} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${LEAVE_TONE_CLASS[k.tone].dot}`} aria-hidden /> {k.label}
              </span>
            ))}
            {anyFromStatus && (
              <span className="basis-full">
                <span className="text-amber-600">*</span> Figura de licencia o vacaciones sin fechas en su historial: se muestra desde hoy hasta su fecha de vuelta.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
