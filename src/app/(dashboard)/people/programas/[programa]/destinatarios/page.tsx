export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { canManageProgram, canViewProgramCandidates } from "@/lib/program-ownership";
import { programFromSlug, programSlug } from "@/lib/padron-programs";
import { describeRequirements, hasCheckableRequirements } from "@/lib/program-requirements";
import { formatNumber, plural } from "@/lib/formato";
import { getProgramOwners } from "@/services/programs";
import { getProgramCandidates, getProgramRequirements } from "@/services/program-requirements";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyMessage } from "@/components/ui/empty-message";
import { BulkSelectTable } from "@/components/programs/bulk-program-people";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { EnrollCandidateButton } from "@/components/programs/enroll-candidate-button";

type Params = { params: Promise<{ programa: string }> };

export async function generateMetadata({ params }: Params) {
  const program = programFromSlug((await params).programa);
  return { title: program ? `Posibles destinatarios · ${program.label}` : "Posibles destinatarios" };
}

const dayText = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default async function ProgramCandidatesPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ programa }, sp] = await Promise.all([params, searchParams]);
  const program = programFromSlug(programa);
  if (!program) notFound();
  const slug = programSlug(program.column);

  const [owners, requirements] = await Promise.all([getProgramOwners(), getProgramRequirements(program.column)]);
  const owner = owners.get(program.column) ?? null;
  if (!canViewProgramCandidates(session.user, owner?.areaId)) redirect(`/people/programas/${slug}`);
  if (!hasCheckableRequirements(requirements)) redirect(`/people/programas/${slug}`);
  const canManage = canManageProgram(session.user, owner?.areaId);
  const scope = { canViewSensitive: hasPermission(session.user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) };
  const list = await getProgramCandidates(program.column, requirements, scope, { q: sp.q, page: Number(sp.page) || 1 });
  const pageHref = (page: number) =>
    `/people/programas/${slug}/destinatarios?${new URLSearchParams({ ...(list.q ? { q: list.q } : {}), page: String(page) })}`;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Registro Único", href: "/people" },
          { label: "Programas", href: "/people/programas" },
          { label: program.label, href: `/people/programas/${slug}` },
          { label: "Posibles destinatarios", active: true },
        ]}
      />
      <PageHeader
        title="Posibles destinatarios"
        description={`Personas del padrón que cumplen los requisitos de ${program.label} y todavía no están en el programa.`}
        icon={UserPlus}
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Requisitos</CardTitle>
          <CardDescription>
            {describeRequirements(requirements).join(". ")}.{requirements.nota ? ` Además: ${requirements.nota}` : ""}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            {list.q ? `${plural(list.total, "persona coincide", "personas coinciden")} con "${list.q}"` : plural(list.total, "persona")}
          </CardTitle>
          <CardDescription>
            Por apellido. Antes de dar el alta, revisá la ficha: la lista no reemplaza el criterio del equipo.
            {canManage ? " Con “Dar de alta” queda con la fecha de hoy; para dar de alta a varias juntas, elegilas con la casilla." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex gap-2" role="search">
            <label htmlFor="destinatarios-buscar" className="sr-only">Buscar en la lista</label>
            <Input id="destinatarios-buscar" name="q" defaultValue={list.q} placeholder="DNI, nombre o barrio" className="h-10 rounded-xl" />
            <Button type="submit" variant="outline" className="h-10 rounded-xl gap-1.5"><Search className="h-4 w-4" /> Buscar</Button>
            {list.q && (
              <Button asChild variant="ghost" className="h-10 rounded-xl">
                <Link href={`/people/programas/${slug}/destinatarios`}>Ver todas</Link>
              </Button>
            )}
          </form>

          {list.people.length === 0 ? (
            <EmptyMessage
              compact
              kind={list.q ? "search" : "done"}
              title={list.q ? "Nadie de la lista coincide con esa búsqueda" : "No queda nadie que cumpla los requisitos"}
              description={list.q ? "Probá con el DNI, una parte del nombre o el barrio." : "Todas las personas que los cumplen ya están en el programa."}
            />
          ) : (
            <BulkSelectTable
              mode="alta"
              column={program.column}
              programLabel={program.label}
              today={todayInArgentina()}
              canManage={canManage}
              headers={["Persona", "DNI", "Edad", "Barrio", "Teléfono", "Antes", ...(canManage ? ["Alta"] : [])]}
              rows={list.people.map((p) => ({
                dni: p.dni,
                nombre: p.nombre,
                cells: [
                  <Link key="n" href={`/people/${p.dni}?tab=programas`} className="text-foreground hover:text-primary hover:underline">
                    {p.nombre || "Sin nombre"}
                  </Link>,
                  p.dni,
                  p.edad !== null ? `${p.edad} ${p.edad === 1 ? "año" : "años"}` : <span className="text-muted-foreground">Sin dato</span>,
                  p.barrio || <span className="text-muted-foreground">Sin barrio</span>,
                  p.telefono || <span className="text-muted-foreground">Sin teléfono</span>,
                  p.ultimaBaja ? `Tuvo baja el ${dayText(p.ultimaBaja)}` : <span className="text-muted-foreground">Nunca estuvo</span>,
                  ...(canManage
                    ? [<EnrollCandidateButton key="a" dni={p.dni} name={p.nombre || `DNI ${p.dni}`} column={program.column} programLabel={program.label} />]
                    : []),
                ],
              }))}
            />
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
