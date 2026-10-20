export const dynamic = "force-dynamic";

import { getAreas, getCaseById } from "@/services/cases";
import { canDeriveCases, canRespondDerivation, getCaseDerivations, hasPendingDerivationFor } from "@/services/derivations";
import { DerivationCard, DeriveCaseButton } from "@/components/cases/derivations";
import { CaseTimeline } from "@/components/cases/case-timeline";
import { getCaseEvents } from "@/services/case-timeline";
import { getCaseInterventions } from "@/services/interventions";
import { ensurePersonInPrisma } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound, redirect } from "next/navigation";
import { User, MapPin, Tag, ArrowLeft, ShieldAlert, ClipboardList, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { QuickInterventionForm } from "./quick-intervention-form";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { getAreaDashboardUrl, getAreaShortName } from "@/lib/area-theme";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolvedParams = await params;
  const id = decodeURIComponent(resolvedParams?.id || "");

  const caseData = await getCaseById(id);

  if (!caseData) notFound();

  let person: any = caseData.person;
  if (!person && caseData.personId) {
    person = await ensurePersonInPrisma(caseData.personId);
  }

  const areaName = caseData.area?.name || "Dirección General de Desarrollo Humano y Hábitat";
  const titleStr = caseData.title || "Expediente Social";

  // Validar permiso para casos sensibles (Violencia de Género)
  const isViolenceCase =
    areaName === "Violencia de Género" ||
    areaName.toLowerCase().includes("violencia");

  if (isViolenceCase) {
    // También lo abre quien tiene que decidir si acepta una derivación a su área.
    const canView =
      hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES) ||
      (await hasPendingDerivationFor(session.user, caseData.id));
    if (!canView) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-rose-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-foreground">Acceso Restringido</h2>
          <p className="text-muted-foreground max-w-md">No tiene los permisos necesarios para visualizar la información de este caso debido a su naturaleza sensible.</p>
          <Button asChild variant="outline">
            <Link href="/people">Volver al Registro</Link>
          </Button>
        </div>
      );
    }
  }

  const isClosed = caseData.status === "CERRADO";
  const [derivations, areas, interventions] = await Promise.all([
    getCaseDerivations(caseData.id),
    getAreas(),
    getCaseInterventions(caseData.id, session.user.id),
  ]);
  const events = await getCaseEvents({ id: caseData.id, createdAt: caseData.createdAt, areaName }, derivations);
  const pendingDerivation = derivations.find((d) => d.status === "PENDIENTE");
  const canDerive = canDeriveCases(session.user) && !isClosed && !pendingDerivation;
  const areaUrl = getAreaDashboardUrl(areaName);
  const areaLabel = getAreaShortName(areaName);

  const breadcrumbs = [
    { label: "Áreas Sociales", href: "/areas/social" },
    { label: areaLabel, href: areaUrl },
    { label: `Expediente ${titleStr.substring(0, 20)}...`, active: true }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title={titleStr}
        description={areaName}
        icon={ClipboardList}
        actions={
          <>
            <Badge variant={isClosed ? 'secondary' : 'default'} className="font-bold uppercase text-[10px]">{caseData.status}</Badge>
            <Button variant="ghost" size="icon" asChild className="rounded-xl">
              <Link href={areaUrl} aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          </>
        }
      />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {pendingDerivation && (
            <DerivationCard d={pendingDerivation} canRespond={canRespondDerivation(session.user, pendingDerivation.toAreaId)} />
          )}

          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Descripción del Caso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{caseData.description || "Sin descripción adicional."}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card space-y-4 p-6">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Historia del expediente</CardTitle>
                <CardDescription>Intervenciones, derivaciones, apertura y cierre, de lo más nuevo a lo más viejo.</CardDescription>
              </div>
            </div>

            {!isClosed && (
              <QuickInterventionForm caseId={caseData.id} caseTitle={titleStr} />
            )}

            <CardContent className="px-0 pt-2">
              <CaseTimeline interventions={interventions} events={events} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
            <CardHeader><CardTitle className="text-lg font-bold text-foreground">Información del Ciudadano</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {person ? (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Link href={`/people/${person.dni || person.id}`} className="font-bold text-foreground hover:underline">
                      {person.lastName}, {person.firstName}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                    <Tag className="h-4 w-4 text-muted-foreground" /> DNI {person.dni}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                    <MapPin className="h-4 w-4 text-muted-foreground" /> {person.address || 'Sin dirección'}
                  </div>
                </>
              ) : (
                <EmptyMessage title="Información del titular no disponible" icon={User} className="py-6" />
              )}
            </CardContent>
          </Card>

          {canDerive && (
            <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" /> Derivaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DeriveCaseButton caseId={caseData.id} areas={areas.map((a) => ({ id: a.id, name: a.name }))} currentAreaId={caseData.areaId} />
                <p className="text-[11px] text-muted-foreground">Las derivaciones anteriores figuran en la historia del expediente.</p>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
             <CardHeader><CardTitle className="text-lg font-bold text-foreground">Fechas del Expediente</CardTitle></CardHeader>
             <CardContent className="space-y-3 text-sm font-semibold">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Apertura</span>
                  <span className="text-foreground">{new Date(caseData.createdAt).toLocaleDateString('es-AR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última actualización</span>
                  <span className="text-foreground">{new Date(caseData.updatedAt).toLocaleDateString('es-AR')}</span>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
