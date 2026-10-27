export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock, CloudRain, Layers, MapPin, MapPinned, Phone, Search, User, Users } from "lucide-react";
import { auth } from "@/auth";
import { canViewStormDeliveries, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { barrioFromSlug, barrioSlug, canDeleteLugar, canEditLugares, lugarTipoLabel } from "@/lib/barrios";
import { caseLabelName } from "@/lib/case-labels";
import { splitCaseTitle } from "@/lib/case-summary";
import { getAreaShortName } from "@/lib/area-theme";
import { formatFecha } from "@/lib/fechas";
import { formatNumber, plural } from "@/lib/formato";
import { getBarrioDetail, getBarrioPeople, BARRIO_CASES_SHOWN } from "@/services/barrios";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { MobileList, MobileListItem, StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseTag } from "@/components/cases/case-tag";
import { DeleteLugarButton, LugarDialog } from "@/components/barrios/lugar-dialog";

type Params = { params: Promise<{ barrio: string }> };

export async function generateMetadata({ params }: Params) {
  const barrio = barrioFromSlug((await params).barrio);
  return { title: barrio ? `${barrio} · Barrio` : "Barrio" };
}

function pct(part: number, total: number) {
  if (!total) return "0 %";
  const p = (part / total) * 100;
  if (part > 0 && p < 0.1) return "menos del 0,1 %";
  return `${p.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "URGENTE") {
    return <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs font-bold">Urgente</Badge>;
  }
  if (priority === "ALTA") {
    return <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 text-xs font-bold">Prioridad alta</Badge>;
  }
  return null;
}

export default async function BarrioPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ barrio: slugParam }, sp] = await Promise.all([params, searchParams]);
  const barrio = barrioFromSlug(slugParam);
  if (!barrio) notFound();
  const slug = barrioSlug(barrio);
  const user = session.user;

  const scope = { canViewSensitive: hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) };
  const [detail, list] = await Promise.all([
    getBarrioDetail(barrio, scope),
    getBarrioPeople(barrio, { q: sp.q, page: Number(sp.page) || 1 }),
  ]);
  const canEdit = canEditLugares(user.role);
  const maxProgram = Math.max(1, ...detail.programs.map((p) => p.total));
  const pageHref = (page: number) =>
    `/barrios/${slug}?${new URLSearchParams({ ...(list.q ? { q: list.q } : {}), page: String(page) })}#personas`;
  const storm = detail.storm;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs items={[{ label: "Barrios", href: "/barrios" }, { label: barrio, active: true }]} />
      <PageHeader
        title={barrio}
        description="Todo lo del barrio en una pantalla. Las personas se cuentan por el barrio cargado en el padrón (o la localidad, si el barrio no es de la lista)."
        icon={MapPinned}
        actions={
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
            <Link href="/barrios" aria-label="Volver a Barrios"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      <StatRow>
        <StatCard label="Personas del padrón" value={formatNumber(detail.people)} icon={Users} tone="blue" hint={`${pct(detail.withPhone, detail.people)} con teléfono`} />
        <StatCard label="Con algún programa" value={formatNumber(detail.withPrograms)} icon={Layers} tone="green" hint={pct(detail.withPrograms, detail.people) + " de las personas"} />
        <StatCard label="Expedientes abiertos" value={formatNumber(detail.openCases)} icon={ClipboardList} tone="orange" hint="De personas del barrio" />
        <StatCard label="Lugares de referencia" value={formatNumber(detail.lugares.length)} icon={MapPin} tone="purple" hint="Escuelas, salitas, comedores…" />
      </StatRow>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Lugares de referencia</CardTitle>
            <CardDescription>Escuelas, salitas, comedores y otros lugares del barrio, con a quién llamar.</CardDescription>
          </div>
          {canEdit && <LugarDialog barrio={barrio} />}
        </CardHeader>
        <CardContent>
          {detail.lugares.length === 0 ? (
            <EmptyMessage
              compact
              icon={MapPin}
              title="Todavía no hay lugares cargados"
              description={canEdit ? "Cargá la escuela, la salita o el comedor del barrio con su contacto: después los ve todo el equipo." : "Los carga el equipo de cada área."}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detail.lugares.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-primary">{lugarTipoLabel(l.tipo)}</span>
                      <p className="font-semibold leading-snug text-foreground">{l.nombre}</p>
                    </div>
                    {canEdit && (
                      <div className="-mr-2 -mt-1 flex shrink-0">
                        <LugarDialog barrio={barrio} lugar={l} />
                        {canDeleteLugar(user, l.createdById) && <DeleteLugarButton barrio={barrio} id={l.id} nombre={l.nombre} />}
                      </div>
                    )}
                  </div>
                  <dl className="space-y-1 text-sm text-muted-foreground">
                    {l.direccion && (
                      <div className="flex gap-2"><dt className="sr-only">Dirección</dt><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{l.direccion}</dd></div>
                    )}
                    {l.contacto && (
                      <div className="flex gap-2"><dt className="sr-only">Contacto</dt><User className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><dd className="text-foreground">{l.contacto}</dd></div>
                    )}
                    {l.telefono && (
                      <div className="flex gap-2">
                        <dt className="sr-only">Teléfono</dt><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <dd><a href={`tel:${l.telefono.replace(/[^\d+]/g, "")}`} className="font-semibold text-primary hover:underline">{l.telefono}</a></dd>
                      </div>
                    )}
                    {l.horario && (
                      <div className="flex gap-2"><dt className="sr-only">Horario</dt><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><dd>{l.horario}</dd></div>
                    )}
                  </dl>
                  {l.notas && <p className="whitespace-pre-line border-t border-border/40 pt-2 text-sm text-foreground">{l.notas}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> En qué programas están</CardTitle>
            <CardDescription>Personas del barrio en cada programa del padrón. Tocá uno para ver el programa.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail.programs.length === 0 ? (
              <EmptyMessage compact title="Nadie del barrio está en un programa" description="Cuando se dé de alta a alguien desde su ficha, aparece acá." />
            ) : (
              <ul className="space-y-2.5">
                {detail.programs.map((p) => (
                  <li key={p.column} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={`/people/programas/${p.slug}`} className="min-w-0 font-semibold text-foreground hover:text-primary hover:underline">{p.label}</Link>
                      <span className="shrink-0 font-bold tabular-nums text-foreground">{formatNumber(p.total)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary/70 dark:bg-primary" style={{ width: `${Math.max(1, (p.total / maxProgram) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" /> Expedientes abiertos</CardTitle>
            <CardDescription>De personas que viven en el barrio, por etiqueta y por área.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {detail.openCases === 0 ? (
              <EmptyMessage compact kind="done" title="No hay expedientes abiertos en el barrio" description="Se cuentan los de personas del padrón que viven acá." />
            ) : (
              <>
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Por etiqueta</h3>
                  <ul className="flex flex-wrap gap-2">
                    {detail.casesByLabel.map((l) => (
                      <li key={l.label ?? "sin"} className="rounded-xl border border-border/60 px-3 py-1.5 text-sm">
                        <span className={l.label ? "text-foreground" : "italic text-muted-foreground"}>{l.label ? caseLabelName(l.label) ?? l.label : "Sin etiqueta"}</span>{" "}
                        <span className="font-bold tabular-nums text-foreground">{formatNumber(l.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Por área</h3>
                  <ul className="divide-y divide-border/40">
                    {detail.casesByArea.map((a) => (
                      <li key={a.areaId} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 text-foreground">{getAreaShortName(a.areaName)}</span>
                        <span className="shrink-0 font-bold tabular-nums text-foreground">{formatNumber(a.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {detail.cases.length > 0 && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Para ver en la recorrida</CardTitle>
            <CardDescription>
              {detail.openCases > detail.cases.length
                ? `Los ${BARRIO_CASES_SHOWN} expedientes abiertos más urgentes de ${formatNumber(detail.openCases)}, los más viejos primero.`
                : "Los expedientes abiertos del barrio, los más urgentes y los más viejos primero."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expediente</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Etiquetas</TableHead>
                    <TableHead className="text-right">Abierto hace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.cases.map((c) => {
                    const t = splitCaseTitle(c.title);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CaseTag tag={t.tag} />
                            <Link href={`/cases/${c.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{t.title}</Link>
                            <PriorityBadge priority={c.priority} />
                          </div>
                        </TableCell>
                        <TableCell>{c.titular || <span className="text-muted-foreground">Sin titular</span>}</TableCell>
                        <TableCell>{getAreaShortName(c.areaName)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.labels.map((l) => caseLabelName(l) ?? l).join(", ") || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{plural(daysSince(c.createdAt), "día")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <MobileList label="Expedientes abiertos" className="-mx-6">
              {detail.cases.map((c) => (
                <MobileListItem
                  key={c.id}
                  href={`/cases/${c.id}`}
                  title={splitCaseTitle(c.title).title}
                  subtitle={`${c.titular || "Sin titular"} · ${getAreaShortName(c.areaName)}`}
                  meta={`Abierto hace ${plural(daysSince(c.createdAt), "día")}`}
                  aside={<PriorityBadge priority={c.priority} />}
                />
              ))}
            </MobileList>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><CloudRain className="h-4 w-4 text-primary" /> Emergencia climática</CardTitle>
            <CardDescription>Fichas de tormenta con este barrio y lo que se entregó.</CardDescription>
          </div>
          {storm.records > 0 && canViewStormDeliveries(user.role) && (
            <Button asChild variant="outline" size="sm" className="self-start rounded-xl font-bold">
              <Link href="/admin/emergency">Ver las fichas</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {storm.records === 0 ? (
            <EmptyMessage compact kind="done" title="No hay fichas de tormenta en el barrio" />
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Fichas</dt>
                <dd className="text-xl font-bold tabular-nums text-foreground">{formatNumber(storm.records)}</dd>
                {storm.lastRecord && <dd className="text-xs text-muted-foreground">La última, del {formatFecha(storm.lastRecord)}</dd>}
              </div>
              <div>
                <dt className="text-muted-foreground">Operativos</dt>
                <dd className="text-xl font-bold tabular-nums text-foreground">{formatNumber(storm.operativos)}</dd>
                <dd className="text-xs text-muted-foreground">Planillas de relevamiento con gente del barrio</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entregas</dt>
                <dd className="text-xl font-bold tabular-nums text-foreground">{formatNumber(storm.deliveries)}</dd>
                {storm.lastDelivery && <dd className="text-xs text-muted-foreground">La última, del {formatFecha(storm.lastDelivery)}</dd>}
              </div>
              <div>
                <dt className="text-muted-foreground">Se entregaron</dt>
                <dd className="text-foreground">
                  {[
                    storm.colchones ? plural(storm.colchones, "colchón", "colchones") : null,
                    storm.camas ? plural(storm.camas, "cama", "camas") : null,
                    storm.frazadas ? plural(storm.frazadas, "frazada") : null,
                  ].filter(Boolean).join(", ") || "Nada todavía"}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none" id="personas">
        <CardHeader>
          <CardTitle className="text-base">Personas del barrio</CardTitle>
          <CardDescription>
            {list.q
              ? `${plural(list.total, "persona coincide", "personas coinciden")} con “${list.q}”.`
              : `${plural(list.total, "persona")} del padrón, por apellido.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" action={`/barrios/${slug}#personas`} className="flex gap-2" role="search">
            <label htmlFor="barrio-buscar" className="sr-only">Buscar en el barrio</label>
            <Input id="barrio-buscar" name="q" defaultValue={list.q} placeholder="DNI, nombre o calle" className="h-10 rounded-xl" />
            <Button type="submit" variant="outline" className="h-10 rounded-xl gap-1.5"><Search className="h-4 w-4" /> Buscar</Button>
            {list.q && (
              <Button asChild variant="ghost" className="h-10 rounded-xl">
                <Link href={`/barrios/${slug}#personas`}>Ver todas</Link>
              </Button>
            )}
          </form>

          {list.people.length === 0 ? (
            <EmptyMessage
              compact
              kind={list.q ? "search" : "empty"}
              title={list.q ? "No hay personas del barrio con esa búsqueda" : "No hay personas del padrón en este barrio"}
              description={list.q ? "Probá con el DNI, una parte del nombre o la calle." : "Se cuentan por el barrio cargado en el padrón."}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-right">Programas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.people.map((p) => (
                      <TableRow key={p.dni}>
                        <TableCell className="font-semibold">
                          <Link href={`/people/${p.dni}`} className="text-foreground hover:text-primary hover:underline">{p.nombre || "Sin nombre"}</Link>
                        </TableCell>
                        <TableCell className="tabular-nums">{p.dni}</TableCell>
                        <TableCell>{p.direccion || <span className="text-muted-foreground">Sin dirección</span>}</TableCell>
                        <TableCell>{p.telefono || <span className="text-muted-foreground">Sin teléfono</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(p.programas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <MobileList label="Personas del barrio" className="-mx-6">
                {list.people.map((p) => (
                  <MobileListItem
                    key={p.dni}
                    href={`/people/${p.dni}`}
                    title={p.nombre || "Sin nombre"}
                    subtitle={`DNI ${p.dni}${p.direccion ? ` · ${p.direccion}` : ""}`}
                    meta={p.programas ? plural(p.programas, "programa") : undefined}
                  />
                ))}
              </MobileList>
            </>
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
