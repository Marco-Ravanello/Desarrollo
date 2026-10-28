export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, Layers, ListChecks, MapPin, Phone, Search, UserPlus, Users } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { canAssignProgramArea, canManageProgram, canViewProgramCandidates } from "@/lib/program-ownership";
import { describeRequirements, hasCheckableRequirements } from "@/lib/program-requirements";
import { programFromSlug, programSlug } from "@/lib/padron-programs";
import { formatNumber, plural } from "@/lib/formato";
import { getProgramDetail, getProgramOwners, getProgramPeople } from "@/services/programs";
import { countProgramCandidates, getProgramRequirements } from "@/services/program-requirements";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProgramMonthsChart } from "@/components/programs/program-months-chart";
import { ProgramAreaDialog } from "@/components/programs/program-area-dialog";
import { ProgramRequirementsDialog } from "@/components/programs/program-requirements-dialog";

type Params = { params: Promise<{ programa: string }> };

export async function generateMetadata({ params }: Params) {
  const program = programFromSlug((await params).programa);
  return { title: program ? `${program.label} · Programa` : "Programa" };
}

const dayText = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function pct(part: number, total: number) {
  if (!total) return "0 %";
  const p = (part / total) * 100;
  if (part > 0 && p < 0.1) return "menos del 0,1 %";
  return `${p.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

export default async function ProgramPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ programa }, sp] = await Promise.all([params, searchParams]);
  const program = programFromSlug(programa);
  if (!program) notFound();
  const slug = programSlug(program.column);

  const canAssign = canAssignProgramArea(session.user.role);
  const canViewSensitive = hasPermission(session.user.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
  const [detail, list, owners, areas, requirements] = await Promise.all([
    getProgramDetail(program.column),
    getProgramPeople(program.column, { q: sp.q, page: Number(sp.page) || 1 }),
    getProgramOwners(),
    canAssign ? prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    getProgramRequirements(program.column),
  ]);
  const owner = owners.get(program.column) ?? null;
  const canManage = canManageProgram(session.user, owner?.areaId);
  const canSeeCandidates = canViewProgramCandidates(session.user, owner?.areaId);
  const checkable = hasCheckableRequirements(requirements);
  const candidates = checkable ? await countProgramCandidates(program.column, requirements, { canViewSensitive }) : null;
  const requirementLines = describeRequirements(requirements);
  const canExport = hasPermission(session.user.role, PERMISSIONS.EXPORT_PERSONAL_DATA);
  const shownBarrios = detail.barrios.slice(0, 10);
  const otherBarrios = detail.people - shownBarrios.reduce((a, b) => a + b.total, 0);
  const pageHref = (page: number) => `/people/programas/${slug}?${new URLSearchParams({ ...(list.q ? { q: list.q } : {}), page: String(page) })}`;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Registro Único", href: "/people" },
          { label: "Programas", href: "/people/programas" },
          { label: program.label, active: true },
        ]}
      />
      <PageHeader
        title={program.label}
        description={
          owner
            ? `A cargo de ${owner.areaName}. Esa área y la conducción dan las altas y bajas desde la ficha de cada persona.`
            : "Sin área a cargo: cualquiera que carga datos le puede dar altas y bajas desde la ficha de cada persona."
        }
        icon={Layers}
        actions={
          canAssign ? (
            <ProgramAreaDialog column={program.column} label={program.label} currentAreaId={owner?.areaId ?? null} areas={areas} />
          ) : undefined
        }
      />

      <StatRow>
        <StatCard label="Personas hoy" value={formatNumber(detail.people)} icon={Users} tone="blue" hint="Con el programa marcado en el padrón" />
        <StatCard label="Altas en el último año" value={formatNumber(detail.altas12)} icon={ArrowUpRight} tone="green" hint="Desde la ficha, por planilla o por ficha de tormenta" />
        <StatCard label="Bajas en el último año" value={formatNumber(detail.bajas12)} icon={ArrowDownRight} tone="orange" hint="Desde la ficha de cada persona" />
        <StatCard label="Con teléfono" value={pct(detail.withPhone, detail.people)} icon={Phone} tone="blue" hint={`${plural(detail.withPhone, "persona")} con teléfono cargado`} />
      </StatRow>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" /> Posibles destinatarios</CardTitle>
            <CardDescription>Personas del padrón que cumplen los requisitos del programa y todavía no están en él.</CardDescription>
          </div>
          {canManage && <ProgramRequirementsDialog column={program.column} label={program.label} current={requirements} />}
        </CardHeader>
        <CardContent>
          {!checkable ? (
            <EmptyMessage
              compact
              icon={ListChecks}
              title="El programa todavía no tiene requisitos cargados"
              description={
                canManage
                  ? "Cargá la edad, el barrio, alguna etiqueta o si tiene que estar en otro programa, y la app arma la lista."
                  : "Los carga el área a cargo del programa o la conducción."
              }
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Requisitos</p>
                <ul className="space-y-1.5 text-sm">
                  {requirementLines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="text-foreground">{line}</span>
                    </li>
                  ))}
                </ul>
                {requirements.nota && <p className="text-sm text-muted-foreground">Además: {requirements.nota}</p>}
              </div>
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-3xl font-bold tabular-nums text-foreground">{formatNumber(candidates?.total ?? 0)}</p>
                <p className="text-sm text-muted-foreground">
                  {candidates?.total === 1 ? "persona los cumple y no está en el programa." : "personas los cumplen y no están en el programa."}
                </p>
                {(candidates?.withoutAge ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {candidates!.withoutAge === 1
                      ? "1 persona más cumple lo demás, pero no tiene edad cargada y no se la pudo revisar."
                      : `${formatNumber(candidates!.withoutAge)} personas más cumplen lo demás, pero no tienen edad cargada y no se las pudo revisar.`}
                  </p>
                )}
                {canSeeCandidates && (candidates?.total ?? 0) > 0 && (
                  <Button asChild size="sm" className="mt-1 rounded-xl font-bold gap-1.5">
                    <Link href={`/people/programas/${slug}/destinatarios`}>Ver la lista <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Altas y bajas por mes</CardTitle>
            <CardDescription>Los últimos 12 meses. Las personas que ya venían en el padrón original no tienen fecha de alta, así que no se cuentan acá.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.altas12 + detail.bajas12 === 0 ? (
              <EmptyMessage compact title="Todavía no hay altas ni bajas registradas" description="Se registran cuando se da de alta o de baja a alguien desde su ficha, o cuando se importa una planilla." />
            ) : (
              <ProgramMonthsChart data={detail.months} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Motivos de baja más comunes</CardTitle>
            <CardDescription>Los que se escribieron al dar de baja, agrupados cuando dicen lo mismo.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.reasons.length === 0 ? (
              <EmptyMessage compact title="Todavía no hay bajas con motivo" description="El motivo se pide cada vez que se da de baja a alguien." />
            ) : (
              <ul className="divide-y divide-border/40">
                {detail.reasons.map((r) => (
                  <li key={r.motivo} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-foreground">{r.motivo}</span>
                    <span className="shrink-0 font-bold tabular-nums text-foreground">{formatNumber(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> En qué barrios están</CardTitle>
          <CardDescription>
            {detail.barrioCount > 0 ? `Personas del programa en ${plural(detail.barrioCount, "barrio")}. Los 10 con más personas:` : "Según el barrio cargado en el padrón."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.people === 0 ? (
            <EmptyMessage compact title="El programa no tiene personas" description="Cuando se dé de alta a alguien desde su ficha o se importe una planilla, aparece acá." />
          ) : (
            <ul className="space-y-2.5">
              {shownBarrios.map((b) => (
                <li key={b.barrio ?? "sin-barrio"} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={b.barrio ? "font-semibold text-foreground" : "italic text-muted-foreground"}>{b.barrio ?? "Sin barrio cargado"}</span>
                    <span className="tabular-nums">
                      <span className="font-bold text-foreground">{formatNumber(b.total)}</span>{" "}
                      <span className="text-muted-foreground">· {pct(b.total, detail.people)}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary/70 dark:bg-primary" style={{ width: `${Math.max(1, (b.total / detail.people) * 100)}%` }} />
                  </div>
                </li>
              ))}
              {otherBarrios > 0 && (
                <li className="flex items-baseline justify-between gap-3 pt-1 text-sm text-muted-foreground">
                  <span>En otros barrios</span>
                  <span className="tabular-nums">{formatNumber(otherBarrios)} · {pct(otherBarrios, detail.people)}</span>
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Personas del programa</CardTitle>
            <CardDescription>
              {list.q
                ? `${plural(list.total, "persona coincide", "personas coinciden")} con "${list.q}".`
                : `${plural(list.total, "persona")}, por apellido. ${canManage ? "Las altas y bajas se dan desde la ficha de cada una." : ""}`}
            </CardDescription>
          </div>
          {canExport && detail.people > 0 && (
            <Button asChild variant="outline" size="sm" className="rounded-xl font-bold gap-1.5 self-start sm:self-auto">
              <a href={`/api/programas/${slug}/exportar`}><Download className="h-4 w-4" /> Bajar la lista</a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex gap-2" role="search">
            <label htmlFor="programa-buscar" className="sr-only">Buscar en el programa</label>
            <Input id="programa-buscar" name="q" defaultValue={list.q} placeholder="DNI, nombre o barrio" className="h-10 rounded-xl" />
            <Button type="submit" variant="outline" className="h-10 rounded-xl gap-1.5"><Search className="h-4 w-4" /> Buscar</Button>
            {list.q && (
              <Button asChild variant="ghost" className="h-10 rounded-xl">
                <Link href={`/people/programas/${slug}`}>Ver todas</Link>
              </Button>
            )}
          </form>

          {list.people.length === 0 ? (
            <EmptyMessage
              compact
              kind={list.q ? "search" : "empty"}
              title={list.q ? "No hay personas del programa con esa búsqueda" : "El programa no tiene personas"}
              description={list.q ? "Probá con el DNI, una parte del nombre o el barrio." : "Cuando se dé de alta a alguien desde su ficha o se importe una planilla, aparece acá."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Barrio</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>En el programa desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.people.map((p) => (
                  <TableRow key={p.dni}>
                    <TableCell className="font-semibold">
                      <Link href={`/people/${p.dni}?tab=programas`} className="text-foreground hover:text-primary hover:underline">
                        {p.nombre || "Sin nombre"}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.dni}</TableCell>
                    <TableCell>{p.barrio || <span className="text-muted-foreground">Sin barrio</span>}</TableCell>
                    <TableCell>{p.telefono || <span className="text-muted-foreground">Sin teléfono</span>}</TableCell>
                    <TableCell>{p.desde ? dayText(p.desde) : <span className="text-muted-foreground">Sin fecha</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {list.pages > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
              {list.page > 1 ? (
                <Button asChild variant="outline" size="sm" className="rounded-xl"><Link href={pageHref(list.page - 1)}>Anterior</Link></Button>
              ) : <span />}
              <span className="text-muted-foreground">Página {formatNumber(list.page)} de {formatNumber(list.pages)}</span>
              {list.page < list.pages ? (
                <Button asChild variant="outline" size="sm" className="rounded-xl"><Link href={pageHref(list.page + 1)}>Siguiente</Link></Button>
              ) : <span />}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
