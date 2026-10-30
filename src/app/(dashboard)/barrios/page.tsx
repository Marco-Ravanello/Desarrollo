export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPinned } from "lucide-react";
import { auth } from "@/auth";
import { MANAGEMENT_ROLES, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatNumber, plural } from "@/lib/formato";
import { getBarrioSummaries } from "@/services/barrios";
import { fechaDeRecorrida, getRecorridaStatsByBarrio, getReferentes } from "@/services/recorridas";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Barrios" };

const zero = (n: number) => (n ? formatNumber(n) : <span className="text-muted-foreground">0</span>);

export default async function BarriosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  const isManagement = MANAGEMENT_ROLES.includes(role);

  const [data, referentes, recorridas] = await Promise.all([
    getBarrioSummaries({ canViewSensitive: hasPermission(role, PERMISSIONS.VIEW_SENSITIVE_CASES) }),
    getReferentes(),
    getRecorridaStatsByBarrio(),
  ]);
  const mine = data.barrios.filter((b) => referentes.get(b.barrio)?.userId === session.user.id);
  const recorridaText = (barrio: string) => {
    const r = recorridas.get(barrio);
    if (r?.proxima) return `Próxima: ${fechaDeRecorrida(r.proxima)}`;
    if (r?.ultima) return `Última: ${fechaDeRecorrida(r.ultima)}`;
    return null;
  };
  const inList = data.totalPeople - data.withoutBarrio;
  const max = Math.max(1, ...data.barrios.map((b) => b.people));

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Barrios", active: true }]} />
      <PageHeader
        title="Barrios"
        description="Los 29 barrios de Tres de Febrero. Tocá uno para ver su mapa, quiénes viven ahí, sus expedientes abiertos y lugares de referencia, y para preparar una recorrida."
        icon={MapPinned}
      />

      {mine.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">Sos referente de </span>
          {mine.map((b, i) => (
            <span key={b.barrio}>
              {i > 0 && (i === mine.length - 1 ? " y " : ", ")}
              <Link href={`/barrios/${b.slug}`} className="font-semibold text-primary hover:underline">{b.barrio}</Link>
            </span>
          ))}
          .
        </div>
      )}

      <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
        <p className="px-2 pb-2 text-sm text-muted-foreground sm:px-0">
          {formatNumber(inList)} de {plural(data.totalPeople, "persona")} del padrón tienen uno de estos barrios en su domicilio.
        </p>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barrio</TableHead>
                <TableHead className="w-[20%]">Personas del padrón</TableHead>
                <TableHead className="text-right">Con algún programa</TableHead>
                <TableHead className="text-right">Expedientes abiertos</TableHead>
                <TableHead className="text-right">Fichas de tormenta</TableHead>
                <TableHead className="text-right">Lugares de referencia</TableHead>
                <TableHead>Referente</TableHead>
                <TableHead>Recorridas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.barrios.map((b) => (
                <TableRow key={b.barrio}>
                  <TableCell className="font-semibold">
                    <Link href={`/barrios/${b.slug}`} className="text-foreground hover:text-primary hover:underline">
                      {b.barrio}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-right tabular-nums">{zero(b.people)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        {b.people > 0 && (
                          <div className="h-full rounded-full bg-primary/70 dark:bg-primary" style={{ width: `${Math.max(2, (b.people / max) * 100)}%` }} />
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{zero(b.withPrograms)}</TableCell>
                  <TableCell className="text-right tabular-nums">{zero(b.openCases)}</TableCell>
                  <TableCell className="text-right tabular-nums">{zero(b.stormRecords)}</TableCell>
                  <TableCell className="text-right tabular-nums">{zero(b.lugares)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{referentes.get(b.barrio)?.name ?? <span className="text-muted-foreground">Sin elegir</span>}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{recorridaText(b.barrio) ?? <span className="text-muted-foreground">Ninguna</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <MobileList label="Barrios">
          {data.barrios.map((b) => (
            <MobileListItem
              key={b.barrio}
              href={`/barrios/${b.slug}`}
              title={b.barrio}
              subtitle={`${plural(b.people, "persona")} · ${plural(b.openCases, "expediente abierto", "expedientes abiertos")}`}
              meta={[referentes.get(b.barrio)?.name ? `Referente: ${referentes.get(b.barrio)!.name}` : null, recorridaText(b.barrio)].filter(Boolean).join(" · ") || undefined}
            />
          ))}
        </MobileList>
      </Card>

      {isManagement && data.withoutBarrio > 0 && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Personas sin un barrio de la lista</CardTitle>
            <CardDescription>
              {plural(data.withoutBarrio, "persona del padrón tiene", "personas del padrón tienen")} un barrio que no es de la lista
              {data.blank ? ` (${formatNumber(data.blank)} sin barrio ni localidad)` : ""}. No se cuentan en ningún barrio. Así está escrito
              {data.unmatchedKinds > data.unmatched.length ? ` (las ${data.unmatched.length} formas más comunes de ${formatNumber(data.unmatchedKinds)})` : ""}:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/40">
              {data.unmatched.map((u) => (
                <li key={u.value} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <Link href={`/people?barrio=${encodeURIComponent(u.value)}`} className="min-w-0 truncate text-foreground hover:text-primary hover:underline">
                    {u.value}
                  </Link>
                  <span className="shrink-0 font-bold tabular-nums text-foreground">{formatNumber(u.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Para pasar a alguien a un barrio de la lista, corregí el barrio con “Editar datos” en su ficha.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
