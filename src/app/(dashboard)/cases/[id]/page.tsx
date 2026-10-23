export const dynamic = "force-dynamic";

import { getAreas, getCaseById } from "@/services/cases";
import { canDeriveCases, canRespondDerivation, getCaseDerivations, hasPendingDerivationFor } from "@/services/derivations";
import { DerivationCard, DeriveCaseButton } from "@/components/cases/derivations";
import { CaseTimeline } from "@/components/cases/case-timeline";
import { getCaseEvents } from "@/services/case-timeline";
import { getCaseInterventions } from "@/services/interventions";
import { ensurePersonInPrisma } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notFound, redirect } from "next/navigation";
import { User, MapPin, Tag, ArrowLeft, ShieldAlert, ClipboardList, History, FileText, Paperclip, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { canEditSocialRecords, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { QuickInterventionForm } from "./quick-intervention-form";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { RememberVisit } from "@/components/search/remember-visit";
import { FollowUpList, ScheduleFollowUpButton } from "@/components/cases/follow-ups";
import { getCaseFollowUps } from "@/services/follow-ups";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { getAreaDashboardUrl, getAreaShortName } from "@/lib/area-theme";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseSummaryHeader } from "@/components/cases/case-summary-header";
import { fechaCorta, isProvisionalDni, splitCaseTitle, summarizeCase } from "@/lib/case-summary";
import { AssignCaseControl } from "@/components/cases/assign-case";
import { canAssignCase, canTakeCase, getAssignableUsers } from "@/services/case-assignment";
import { canCloseOrReopenCase } from "@/lib/case-closing";
import { CloseReopenCaseButton } from "@/components/cases/close-reopen-case";

export const metadata = { title: "Expediente" };

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
  const titleStr = caseData.title || "Expediente";
  const shownTitle = splitCaseTitle(titleStr);

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
          <ShieldAlert className="h-16 w-16 text-rose-700 dark:text-rose-400 animate-pulse" />
          <h2 className="text-2xl font-bold text-foreground">Acceso restringido</h2>
          <p className="text-muted-foreground max-w-md">Tu rol no puede ver este expediente porque tiene datos sensibles.</p>
          <Button asChild variant="outline">
            <Link href="/people">Volver al registro</Link>
          </Button>
        </div>
      );
    }
  }

  const isClosed = caseData.status === "CERRADO";
  const [derivations, areas, interventions, followUps] = await Promise.all([
    getCaseDerivations(caseData.id),
    getAreas(),
    getCaseInterventions(caseData.id, session.user.id),
    getCaseFollowUps(caseData.id),
  ]);
  const today = todayInArgentina();
  const canScheduleFollowUp = !isClosed && canEditSocialRecords(session.user.role);
  const events = await getCaseEvents({ id: caseData.id, createdAt: caseData.createdAt, areaName }, derivations);
  const pendingDerivation = derivations.find((d) => d.status === "PENDIENTE");
  const canDerive = canDeriveCases(session.user) && !isClosed && !pendingDerivation;
  const areaUrl = getAreaDashboardUrl(areaName, caseData.areaId);
  const areaLabel = getAreaShortName(areaName);

  const canAssign = !isClosed && canAssignCase(session.user, caseData.areaId);
  const canTake = !isClosed && canTakeCase(session.user, caseData.areaId);
  // Mientras hay una derivación sin responder no se cierra (primero la responde el área que la recibe).
  const canCloseOrReopen = canCloseOrReopenCase(session.user, areaName) && (isClosed || !pendingDerivation);
  const assignOptions = canAssign ? await getAssignableUsers({ areaId: caseData.areaId, areaName }) : [];
  const assignee = caseData.assignedTo;
  const assigneeName = assignee ? assignee.name || assignee.email || "Usuario" : null;

  const lastIntervention = interventions[0] ?? null;
  const lastClose = events.filter((e) => e.kind === "CIERRE").at(-1);
  const closedAt = isClosed ? (lastClose ? new Date(lastClose.date) : caseData.updatedAt) : null;
  const summary = summarizeCase({
    status: caseData.status,
    createdAt: caseData.createdAt,
    closedAt,
    lastInterventionAt: lastIntervention ? new Date(lastIntervention.date) : null,
  });
  const personName = person ? [person.lastName, person.firstName].filter(Boolean).join(", ") : null;
  const documents = caseData.documents ?? [];
  const historyCount = interventions.length + events.length;

  const breadcrumbs = [
    { label: "Expedientes", href: "/cases" },
    { label: areaLabel, href: areaUrl },
    { label: `Expediente ${shownTitle.title.substring(0, 20)}...`, active: true }
  ];

  const tabClass = "rounded-xl text-xs font-bold gap-1.5 px-3";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageBreadcrumbs items={breadcrumbs} />
      <RememberVisit kind="case" id={caseData.id} />

      <PageHeader
        title={shownTitle.title}
        badge={shownTitle.tag ?? undefined}
        icon={ClipboardList}
        actions={
          <>
            {canScheduleFollowUp && <ScheduleFollowUpButton caseId={caseData.id} today={today} />}
            {canCloseOrReopen && <CloseReopenCaseButton caseId={caseData.id} mode={isClosed ? "reopen" : "close"} />}
            {canDerive && (
              <DeriveCaseButton
                caseId={caseData.id}
                areas={areas.map((a) => ({ id: a.id, name: a.name }))}
                currentAreaId={caseData.areaId}
                triggerClassName=""
              />
            )}
            <Button variant="ghost" size="icon" asChild className="rounded-xl">
              <Link href={areaUrl} aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          </>
        }
      />

      <CaseSummaryHeader
        status={caseData.status}
        priority={caseData.priority}
        areaName={areaName}
        areaLabel={areaLabel}
        areaUrl={areaUrl}
        createdAt={caseData.createdAt}
        closedAt={closedAt}
        summary={summary}
        lastIntervention={lastIntervention}
        pendingTo={pendingDerivation?.toArea ?? null}
        person={person && personName ? { name: personName, dni: isProvisionalDni(person.dni) ? null : person.dni ?? null, href: `/people/${person.dni || person.id}` } : null}
        assigneeName={assigneeName}
        assignmentControl={
          (canAssign || canTake) && (
            <AssignCaseControl
              caseId={caseData.id}
              areaLabel={areaLabel}
              assigneeId={assignee?.id ?? null}
              canAssign={canAssign}
              canTake={canTake}
              currentUserId={session.user.id!}
              options={assignOptions}
            />
          )
        }
      />

      {pendingDerivation && (
        <DerivationCard d={pendingDerivation} canRespond={canRespondDerivation(session.user, pendingDerivation.toAreaId)} />
      )}

      <Tabs defaultValue="historia" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl border border-border/40 bg-muted/40 p-1">
          <TabsTrigger value="historia" className={tabClass}>
            <History className="h-3.5 w-3.5" /> Historia ({historyCount})
          </TabsTrigger>
          <TabsTrigger value="detalle" className={tabClass}>
            <FileText className="h-3.5 w-3.5" /> Detalle y titular
          </TabsTrigger>
          <TabsTrigger value="documentos" className={tabClass}>
            <Paperclip className="h-3.5 w-3.5" /> Documentos ({documents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historia" className="mt-0">
          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card space-y-4 p-6">
            <div className="pb-2 border-b border-border/40">
              <CardTitle className="text-lg font-bold text-foreground">Historia del expediente</CardTitle>
              <CardDescription>Intervenciones, derivaciones, seguimientos, apertura y cierre, de lo más nuevo a lo más viejo.</CardDescription>
            </div>

            <FollowUpList items={followUps} today={today} currentUserId={session.user.id!} />

            {!isClosed && (
              <QuickInterventionForm caseId={caseData.id} caseTitle={titleStr} />
            )}

            <CardContent className="px-0 pt-2">
              <CaseTimeline interventions={interventions} events={events} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalle" className="mt-0">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 rounded-2xl border border-border/60 shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{caseData.description || "Sin descripción adicional."}</p>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
                <CardHeader><CardTitle className="text-lg font-bold text-foreground">Titular</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {person ? (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Link href={`/people/${person.dni || person.id}`} className="font-bold text-foreground hover:underline">
                          {personName}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                        <Tag className="h-4 w-4 text-muted-foreground" /> {isProvisionalDni(person.dni) ? "Sin DNI" : `DNI ${person.dni}`}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                        <MapPin className="h-4 w-4 text-muted-foreground" /> {person.address || 'Sin dirección'}
                      </div>
                      {person.dni && !isProvisionalDni(person.dni) && (
                        <Button variant="outline" size="sm" asChild className="w-full rounded-xl font-bold">
                          <Link href={`/people/${person.dni}`}>Ver ficha de la persona</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <EmptyMessage compact title="Este expediente no tiene titular cargado" icon={User} />
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/60 shadow-sm bg-card">
                <CardHeader><CardTitle className="text-lg font-bold text-foreground">Fechas</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm font-semibold">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Apertura</span>
                    <span className="text-foreground">{fechaCorta(caseData.createdAt)}</span>
                  </div>
                  {closedAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Cierre</span>
                      <span className="text-foreground">{fechaCorta(closedAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Última actualización</span>
                    <span className="text-foreground">{fechaCorta(caseData.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="mt-0">
          <Card className="rounded-2xl border border-border/60 shadow-sm bg-card p-6 space-y-4">
            {documents.length === 0 ? (
              <EmptyMessage compact title="Este expediente todavía no tiene documentos" description="Los informes, fotos y constancias que se adjunten aparecen acá." icon={Paperclip} className="rounded-2xl border border-dashed border-border/60" />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {documents.map((d) => {
                  const href = d.url.startsWith("/api") ? d.url : `/api${d.url}`;
                  return (
                    <div key={d.id} className="p-3 border border-border/60 rounded-2xl flex justify-between items-center gap-3 bg-muted/20">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{fechaCorta(d.createdAt)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="shrink-0 text-primary font-bold">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {person && (
              <p className="text-xs text-muted-foreground">
                Los documentos se adjuntan desde el{" "}
                <Link href={`/people/${person.dni || person.id}`} className="font-semibold text-primary hover:underline">ficha de la persona</Link>.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
