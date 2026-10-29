export const dynamic = "force-dynamic";

import { getAgreements } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Landmark, CheckCircle2, Wallet, CalendarClock, AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { agreementsByArea, canCreateAgreements } from "@/lib/convenios";
import { formatPesos, plural } from "@/lib/formato";
import { AgreementEndLabel, AgreementStatusBadge } from "@/components/agreements/agreement-status";

export const metadata = { title: "Convenios" };

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ areaId?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const canCreate = canCreateAgreements(session.user.role);
  const today = todayInArgentina();
  const { areaId } = await searchParams;
  const [agreements, areas] = await Promise.all([getAgreements(), getAreas()]);

  const todas = agreementsByArea(
    areas.map((a) => ({ id: a.id, name: a.name })),
    agreements,
    today
  );
  // ?areaId= muestra una sola área (el enlace "Ver solo esta área"); "sin" es la de los convenios sin área.
  const elegida = areaId ? todas.find((g) => (areaId === "sin" ? g.id === null : g.id === areaId)) : undefined;
  const grupos = elegida ? [elegida] : todas;
  const total = grupos.reduce(
    (t, g) => ({
      vigentes: t.vigentes + g.vigentes,
      porVencer: t.porVencer + g.porVencer,
      vencidos: t.vencidos + g.vencidos,
      monto: t.monto + g.montoVigente,
    }),
    { vigentes: 0, porVencer: 0, vencidos: 0, monto: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={elegida ? `Convenios · ${elegida.name}` : "Convenios"}
        description="Los convenios de cada área, con su vigencia y su monto."
        icon={Landmark}
        actions={
          <>
            {elegida && (
              <Button asChild variant="outline">
                <Link href="/admin/agreements">Ver todas las áreas</Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild>
                <Link href={elegida?.id ? `/admin/agreements/new?areaId=${elegida.id}` : "/admin/agreements/new"}>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo convenio
                </Link>
              </Button>
            )}
          </>
        }
      />

      {agreements.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="p-0">
            <EmptyMessage
              icon={FileText}
              title="Todavía no hay convenios cargados"
              description={
                canCreate
                  ? "Los convenios que cargues aparecen acá, separados por área, con su vigencia y su monto."
                  : "Los cargan Administración General, Dirección General y Superadmin. Cuando haya, aparecen acá."
              }
              action={
                canCreate ? (
                  <Button asChild size="sm" className="rounded-xl text-xs">
                    <Link href="/admin/agreements/new">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Cargar el primero
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <StatRow>
            <StatCard label="Vigentes" value={total.vigentes} hint={elegida ? "En esta área" : "En todas las áreas"} icon={CheckCircle2} tone="green" />
            <StatCard label="Monto de los vigentes" value={formatPesos(total.monto)} hint="Suma de lo firmado" icon={Wallet} tone="blue" />
            <StatCard label="Por vencer" value={total.porVencer} hint="En los próximos 60 días" icon={CalendarClock} tone="orange" />
            <StatCard
              label="Vencidos"
              value={total.vencidos}
              hint={total.vencidos > 0 ? "Pasó la fecha y siguen como vigentes" : "Ninguno pasado de fecha"}
              icon={AlertTriangle}
              tone="red"
            />
          </StatRow>

          <div className="grid gap-6 md:grid-cols-2">
            {grupos.map((g) => (
              <Card key={g.id ?? "sin"} className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="gap-1 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg font-bold text-foreground">{g.name}</CardTitle>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                      {plural(g.convenios.length, "convenio")}
                    </span>
                  </div>
                  {g.convenios.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {plural(g.vigentes, "vigente")}
                      {g.montoVigente > 0 && <> · {formatPesos(g.montoVigente)}</>}
                      {g.porVencer > 0 && (
                        <span className="font-semibold text-amber-700 dark:text-amber-300"> · {plural(g.porVencer, "por vencer", "por vencer")}</span>
                      )}
                      {g.vencidos > 0 && (
                        <span className="font-semibold text-rose-700 dark:text-rose-300"> · {plural(g.vencidos, "vencido")}</span>
                      )}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {g.convenios.length === 0 ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-muted-foreground">Todavía no tiene convenios cargados.</p>
                      {canCreate && g.id && (
                        <Button asChild size="sm" variant="outline" className="rounded-xl text-xs">
                          <Link href={`/admin/agreements/new?areaId=${g.id}`}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Cargar uno
                          </Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
                      {g.convenios.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/admin/agreements/${a.id}`}
                            className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="font-semibold text-foreground group-hover:text-primary">{a.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <AgreementStatusBadge state={a.state} />
                                <span>{a.number || "Sin número"}</span>
                                <AgreementEndLabel state={a.state} />
                                {a.amount !== null && Number(a.amount) > 0 && (
                                  <span className="font-bold tabular-nums text-foreground sm:hidden">{formatPesos(Number(a.amount))}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {a.amount !== null && Number(a.amount) > 0 && (
                                <span className="hidden text-sm font-bold tabular-nums text-foreground sm:inline">{formatPesos(Number(a.amount))}</span>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!elegida && g.convenios.length > 3 && (
                    <Link
                      href={`/admin/agreements?areaId=${g.id ?? "sin"}`}
                      className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                    >
                      Ver solo esta área
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
