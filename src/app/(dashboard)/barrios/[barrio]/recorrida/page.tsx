export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Route } from "lucide-react";
import { auth } from "@/auth";
import { barrioFromSlug, barrioSlug } from "@/lib/barrios";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import {
  MOTIVOS_SUGERIDOS, RECORRIDA_MAX, RECORRIDA_MOTIVOS, YA_VISITADOS_DIAS, canPlanRecorridas, criteriaToParams, parseRecorridaCriteria,
} from "@/lib/recorridas";
import { diaAR } from "@/lib/fechas";
import { formatNumber, plural } from "@/lib/formato";
import { buildRecorridaList, getRecorridaUserOptions, getReferente } from "@/services/recorridas";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyMessage } from "@/components/ui/empty-message";
import { RecorridaBuilder } from "@/components/barrios/recorrida-builder";

type Params = { params: Promise<{ barrio: string }> };

export async function generateMetadata({ params }: Params) {
  const barrio = barrioFromSlug((await params).barrio);
  return { title: barrio ? `Preparar recorrida · ${barrio}` : "Preparar recorrida" };
}

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Armar la lista de a quién visitar en un barrio: se eligen los motivos, se revisa la lista y se guarda. */
export default async function PrepararRecorridaPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ barrio: slugParam }, sp] = await Promise.all([params, searchParams]);
  const barrio = barrioFromSlug(slugParam);
  if (!barrio) notFound();
  const slug = barrioSlug(barrio);
  if (!canPlanRecorridas(session.user.role)) redirect(`/barrios/${slug}?ver=recorridas`);

  // La primera vez (sin buscar todavía) se proponen los motivos más comunes.
  const firstTime = sp.armar === undefined;
  const criteria = firstTime ? { ...parseRecorridaCriteria({}), motivos: MOTIVOS_SUGERIDOS } : parseRecorridaCriteria(sp);
  const [list, referente, userOptions] = await Promise.all([
    buildRecorridaList(barrio, criteria),
    getReferente(barrio),
    getRecorridaUserOptions(),
  ]);
  const query = criteriaToParams(criteria).toString();
  const defaultEquipo = Array.from(new Set([session.user.id, referente?.userId].filter(Boolean) as string[]));

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Barrios", href: "/barrios" },
          { label: barrio, href: `/barrios/${slug}?ver=recorridas` },
          { label: "Preparar recorrida", active: true },
        ]}
      />
      <PageHeader
        title={`Preparar una recorrida por ${barrio}`}
        description="Elegí por qué visitar a las personas: la app arma la lista ordenada por calle. Después sacás a quien no haga falta, elegís el día y el equipo, y la guardás para imprimirla o llevarla en el celular."
        icon={Route}
      />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">¿A quiénes visitar?</CardTitle>
          <CardDescription>Entra en la lista quien cumpla alguno de los motivos marcados. Los expedientes de Violencia de Género nunca se incluyen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action={`/barrios/${slug}/recorrida`} className="space-y-5">
            <input type="hidden" name="armar" value="1" />
            <fieldset>
              <legend className="sr-only">Motivos</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {RECORRIDA_MOTIVOS.filter((m) => m.key !== "programa").map((m) => (
                  <label key={m.key} htmlFor={`motivo-${m.key}`} className="flex cursor-pointer gap-3 rounded-xl border border-border/60 p-3 hover:border-primary/40">
                    <input
                      id={`motivo-${m.key}`}
                      type="checkbox"
                      name="motivo"
                      value={m.key}
                      defaultChecked={criteria.motivos.includes(m.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </label>
                ))}
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
                  <label htmlFor="recorrida-programa" className="text-sm font-semibold text-foreground">En un programa</label>
                  <select id="recorrida-programa" name="programa" defaultValue={criteria.programa ?? ""} className={selectClass}>
                    <option value="">Ninguno</option>
                    {PADRON_PROGRAMS.map((p) => (
                      <option key={p.column} value={p.column}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="recorrida-calle" className="text-sm font-semibold text-foreground">Solo en una calle (opcional)</label>
                <Input id="recorrida-calle" name="calle" defaultValue={criteria.calle ?? ""} placeholder="Por ejemplo: Perón" className="h-10 rounded-xl" />
              </div>
              <label htmlFor="recorrida-visitados" className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-foreground md:pb-2">
                <input id="recorrida-visitados" type="checkbox" name="visitados" value="1" defaultChecked={!criteria.sinVisitados} className="h-4 w-4 accent-primary" />
                Incluir a quienes ya se visitaron en los últimos {YA_VISITADOS_DIAS} días
              </label>
              <Button type="submit" variant="outline" className="h-10 rounded-xl font-bold">Armar la lista</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">La lista</CardTitle>
          <CardDescription>
            {list.total === 0
              ? "Nadie del barrio cumple esos motivos."
              : list.truncated
                ? `${plural(list.total, "persona cumple", "personas cumplen")} los motivos. Quedan las ${formatNumber(RECORRIDA_MAX)} con más motivos; para otras, elegí una calle.`
                : `${plural(list.total, "persona para visitar", "personas para visitar")}, ordenadas por calle (de cada vereda, una para un lado y otra para el otro).`}
            {list.excludedVisited > 0 && ` Se sacaron ${plural(list.excludedVisited, "persona que ya se visitó", "personas que ya se visitaron")} en los últimos ${YA_VISITADOS_DIAS} días.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.people.length === 0 ? (
            <EmptyMessage
              compact
              kind={criteria.motivos.length ? "search" : "empty"}
              title={criteria.motivos.length ? "No hay personas para esos motivos" : "Marcá al menos un motivo"}
              description={criteria.motivos.length ? "Probá con otros motivos o sin filtrar por calle." : "Después tocá “Armar la lista”."}
              action={
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/barrios/${slug}?ver=recorridas`}>Volver al barrio</Link>
                </Button>
              }
            />
          ) : (
            <RecorridaBuilder
              barrio={barrio}
              criteria={query}
              people={list.people}
              userOptions={userOptions}
              defaultEquipo={defaultEquipo}
              today={diaAR()}
              backHref={`/barrios/${slug}?ver=recorridas`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
