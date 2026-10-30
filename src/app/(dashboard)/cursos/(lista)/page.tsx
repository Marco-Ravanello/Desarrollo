export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Search } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { formatNumber, plural } from "@/lib/formato";
import { CURSO_ESTADOS, canChooseCursoArea, canCreateCursos, cursoTipoLabel, type CursoEstado } from "@/lib/cursos";
import { getCursoFormOptions, getCursos } from "@/services/cursos";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyMessage } from "@/components/ui/empty-message";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CursoDialog } from "@/components/cursos/curso-controls";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cursos y talleres" };

type SearchParams = Promise<{ estado?: string; area?: string; q?: string }>;

const ESTADO_TABS = [
  { key: "ABIERTO", label: "En curso" },
  { key: "TERMINADO", label: "Terminados" },
  { key: "TODOS", label: "Todos" },
] as const;

function EstadoBadge({ estado }: { estado: string }) {
  const done = estado === "TERMINADO";
  return (
    <Badge
      variant="outline"
      className={done ? "border-border bg-muted text-muted-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}
    >
      {CURSO_ESTADOS[estado as CursoEstado] ?? estado}
    </Badge>
  );
}

const pct = (n: number | null) => (n === null ? <span className="text-muted-foreground">Sin clases</span> : `${n} %`);

/** Cursos y talleres: la lista, con cuántos inscriptos tiene cada uno y cómo viene la asistencia. */
export default async function CursosPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = session.user;
  const sp = await searchParams;
  const estado = sp.estado === "TERMINADO" || sp.estado === "TODOS" ? sp.estado : "ABIERTO";
  const areaId = sp.area ?? "";
  const q = (sp.q ?? "").trim();
  const canCreate = canCreateCursos(user.role);

  const [cursos, areas, options] = await Promise.all([
    getCursos({ estado: estado === "TODOS" ? undefined : estado, areaId: areaId || undefined, q }),
    prisma.area.findMany({ where: { cursos: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canCreate ? getCursoFormOptions(user) : null,
  ]);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(estado !== "ABIERTO" ? { estado } : {}), ...(areaId ? { area: areaId } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "estado" && v === "ABIERTO")) p.delete(k);
    const s = p.toString();
    return s ? `/cursos?${s}` : "/cursos";
  };
  const filtered = Boolean(areaId || q);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Cursos y talleres", active: true }]} />
      <PageHeader
        title="Cursos y talleres"
        description="Los cursos del Centro de Formación y los talleres de cada área: inscriptos, asistencia de cada clase y certificados."
        icon={GraduationCap}
        actions={
          options && (
            <CursoDialog
              areas={options.areas}
              programas={options.programas}
              canChooseArea={canChooseCursoArea(user.role)}
              defaultAreaId={user.areaId ?? null}
              today={todayInArgentina()}
            />
          )
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Estado" className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
          {ESTADO_TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ estado: t.key })}
              aria-current={estado === t.key ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                estado === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/cursos" className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {estado !== "ABIERTO" && <input type="hidden" name="estado" value={estado} />}
          {areas.length > 1 && (
            <select
              name="area"
              defaultValue={areaId}
              aria-label="Área"
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Nombre, docente o lugar"
              aria-label="Buscar"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-64"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 rounded-xl text-xs font-bold">Buscar</Button>
        </form>
      </div>

      {cursos.length === 0 ? (
        <EmptyMessage
          kind={filtered ? "search" : "empty"}
          icon={GraduationCap}
          title={filtered ? "No hay cursos con esa búsqueda" : estado === "TERMINADO" ? "Todavía no terminó ningún curso" : "Todavía no hay cursos cargados"}
          description={
            filtered
              ? "Probá con otra palabra o con todas las áreas."
              : canCreate && estado !== "TERMINADO"
                ? "Creá el primero con “Nuevo curso o taller”. Después sumás a los inscriptos y tomás asistencia en cada clase, desde el celular."
                : undefined
          }
          action={filtered ? <Button asChild variant="outline" className="rounded-xl"><Link href={href({ area: "", q: "" })}>Ver todos</Link></Button> : undefined}
        />
      ) : (
        <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
          <p className="px-2 pb-2 text-sm text-muted-foreground sm:px-0">{plural(cursos.length, "curso o taller", "cursos y talleres")}.</p>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Área y programa</TableHead>
                  <TableHead className="text-right">Inscriptos</TableHead>
                  <TableHead className="text-right">Clases</TableHead>
                  <TableHead className="text-right">Asistencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cursos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/cursos/${c.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{c.nombre}</Link>
                      <p className="text-xs text-muted-foreground">
                        {cursoTipoLabel(c.tipo)}{c.docente ? ` · ${c.docente}` : ""}{c.lugar ? ` · ${c.lugar}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.periodo}
                      {c.horario && <p className="text-xs text-muted-foreground">{c.horario}</p>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.area ?? <span className="text-muted-foreground">Sin área</span>}
                      {c.programa && <p className="text-xs text-muted-foreground">{c.programa}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.inscriptos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.clases)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{pct(c.asistencia)}</TableCell>
                    <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MobileList label="Cursos y talleres">
            {cursos.map((c) => (
              <MobileListItem
                key={c.id}
                href={`/cursos/${c.id}`}
                title={c.nombre}
                subtitle={`${c.periodo}${c.horario ? ` · ${c.horario}` : ""}`}
                meta={`${plural(c.inscriptos, "inscripto")} · ${plural(c.clases, "clase")}${c.asistencia !== null ? ` · asistencia ${c.asistencia} %` : ""}`}
                aside={<EstadoBadge estado={c.estado} />}
              />
            ))}
          </MobileList>
        </Card>
      )}
    </div>
  );
}
