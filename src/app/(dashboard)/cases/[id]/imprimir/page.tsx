export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCaseById } from "@/services/cases";
import { getCaseDerivations, hasPendingDerivationFor } from "@/services/derivations";
import { getCaseEvents } from "@/services/case-timeline";
import { getCaseInterventions } from "@/services/interventions";
import { CASE_PRIORITY_LABEL, CASE_STATUS_LABEL, isProvisionalDni, splitCaseTitle } from "@/lib/case-summary";
import { caseLabelName } from "@/lib/case-labels";
import { interventionTypeLabel } from "@/lib/intervention-types";
import { formatFecha, formatFechaHora } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { PrintButton, PrintBrandStrip } from "@/components/ui/print-layout";
import { caseTitle } from "@/lib/page-titles";

export const generateMetadata = caseTitle;

function Dato({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground print:text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold text-foreground print:text-slate-900">{value || "—"}</dd>
    </div>
  );
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

type Movimiento = { id: string; date: string; tipo: string; quien: string | null; texto: string | null };

/**
 * El expediente para imprimir en A4, con el membrete de la Municipalidad: los datos, el titular,
 * la descripción y toda la historia de lo más viejo a lo más nuevo. Queda anotado en Auditoría.
 */
export default async function PrintCasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = decodeURIComponent((await params).id || "");
  const caseData = await getCaseById(id);
  if (!caseData) notFound();

  const areaName = caseData.area?.name || "Dirección General de Desarrollo Humano y Hábitat";
  // Violencia de Género: lo mismo que en la página del expediente.
  if (areaName.toLowerCase().includes("violencia")) {
    const canView =
      hasPermission(session.user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) || (await hasPendingDerivationFor(session.user, caseData.id));
    if (!canView) redirect(`/cases/${encodeURIComponent(caseData.id)}`);
  }

  const derivations = await getCaseDerivations(caseData.id);
  const [interventions, events] = await Promise.all([
    getCaseInterventions(caseData.id),
    getCaseEvents({ id: caseData.id, createdAt: caseData.createdAt, areaName }, derivations),
  ]);

  await prisma.auditLog
    .create({ data: { userId: session.user.id, action: "PRINT_CASE", entity: "Case", entityId: caseData.id, details: caseData.title } })
    .catch(() => null);

  const shown = splitCaseTitle(caseData.title || "Expediente");
  const person = caseData.person;
  const personName = person ? [person.lastName, person.firstName].filter(Boolean).join(", ") : null;
  const lastClose = events.filter((e) => e.kind === "CIERRE").at(-1);
  const assignee = caseData.assignedTo ? caseData.assignedTo.name || caseData.assignedTo.email : null;
  const labels = (caseData.labels ?? []).map((k) => caseLabelName(k)).filter(Boolean).join(", ");
  const referencia = caseData.id.slice(-8).toUpperCase();

  // La historia en el orden en que pasó (en papel se lee de arriba hacia abajo).
  const historia: Movimiento[] = [
    ...interventions.map((i) => ({
      id: i.id,
      date: i.date,
      tipo: `Intervención${interventionTypeLabel(i.type) ? ` · ${interventionTypeLabel(i.type)}` : ""}`,
      quien: i.author,
      texto: i.description,
    })),
    ...events.map((e) => ({ id: e.id, date: e.date, tipo: e.title, quien: e.author, texto: e.detail })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const documents = caseData.documents ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      {/* El expediente trae su propia firma: no se imprime el pie general (que pide la firma de quien recibe). */}
      <style>{"@media print { .print-default-footer { display: none !important; } }"}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" asChild className="gap-1.5 rounded-xl text-xs font-bold">
          <Link href={`/cases/${encodeURIComponent(caseData.id)}`}>
            <ArrowLeft className="h-4 w-4" /> Volver al expediente
          </Link>
        </Button>
        <PrintButton label="Imprimir expediente" />
      </div>
      <p className="text-xs text-muted-foreground print:hidden">
        Así sale en papel, con el membrete de la Municipalidad. Tiene datos personales: guardalo en el legajo y no lo dejes a la vista.
      </p>

      <article className="space-y-6 rounded-2xl border border-border/60 bg-card p-6 sm:p-8 print:border-0 print:bg-white print:p-0 print:text-slate-900">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4 print:border-slate-300">
          <div className="flex min-w-0 items-start gap-3">
            <ClipboardList className="mt-0.5 h-7 w-7 shrink-0 text-primary print:hidden" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground print:text-slate-600">Expediente</p>
              <h1 className="text-lg font-bold text-foreground print:text-[#163C68]">{shown.title}</h1>
              {shown.tag && <p className="text-xs font-semibold text-muted-foreground print:text-slate-600">{shown.tag}</p>}
            </div>
          </div>
          <p className="shrink-0 text-right text-sm font-bold tabular-nums text-foreground print:text-slate-900">Ref. {referencia}</p>
        </header>

        <section className="space-y-3 break-inside-avoid">
          <h2 className="text-sm font-bold text-foreground print:text-[#163C68]">Datos del expediente</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Dato label="Área" value={areaName} />
            <Dato label="Estado" value={CASE_STATUS_LABEL[caseData.status] ?? caseData.status} />
            <Dato label="Prioridad" value={capital(CASE_PRIORITY_LABEL[caseData.priority]?.replace(/^Prioridad /, "") ?? caseData.priority)} />
            <Dato label="Profesional a cargo" value={assignee ?? "Sin asignar"} />
            <Dato label="Apertura" value={formatFecha(caseData.createdAt)} />
            {caseData.status === "CERRADO" && <Dato label="Cierre" value={formatFecha(lastClose ? lastClose.date : caseData.updatedAt)} />}
            {labels && <Dato label="Etiquetas" value={labels} />}
          </dl>
        </section>

        <section className="space-y-3 break-inside-avoid">
          <h2 className="text-sm font-bold text-foreground print:text-[#163C68]">Titular</h2>
          {person ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Dato label="Apellido y nombre" value={personName} />
              <Dato label="DNI" value={isProvisionalDni(person.dni) ? "Sin DNI" : person.dni} />
              <Dato label="Fecha de nacimiento" value={person.birthDate ? formatFecha(person.birthDate) : null} />
              <Dato label="Domicilio" value={person.address} />
              <Dato label="Teléfono" value={person.phone} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground print:text-slate-600">Este expediente no tiene titular cargado.</p>
          )}
        </section>

        <section className="space-y-2 break-inside-avoid">
          <h2 className="text-sm font-bold text-foreground print:text-[#163C68]">Motivo</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground print:text-slate-900">
            {caseData.description || "Sin descripción."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground print:text-[#163C68]">
            Historia <span className="font-normal text-muted-foreground print:text-slate-600">(de lo más viejo a lo más nuevo)</span>
          </h2>
          {historia.length === 0 ? (
            <p className="text-sm text-muted-foreground print:text-slate-600">Todavía no tiene movimientos.</p>
          ) : (
            <ol className="divide-y divide-border/60 border-y border-border/60 print:divide-slate-300 print:border-slate-300">
              {historia.map((m) => (
                <li key={`${m.id}-${m.date}`} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 break-inside-avoid">
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground print:text-slate-600">{formatFechaHora(m.date)}</p>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-bold text-foreground print:text-slate-900">
                      {m.tipo}
                      {m.quien && <span className="font-normal text-muted-foreground print:text-slate-600"> · {m.quien}</span>}
                    </p>
                    {m.texto && <p className="whitespace-pre-wrap text-sm text-foreground print:text-slate-900">{m.texto}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {documents.length > 0 && (
          <section className="space-y-2 break-inside-avoid">
            <h2 className="text-sm font-bold text-foreground print:text-[#163C68]">Documentos adjuntos en el sistema</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground print:text-slate-900">
              {documents.map((d) => (
                <li key={d.id}>
                  {d.name} <span className="text-muted-foreground print:text-slate-600">({formatFecha(d.createdAt)})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="hidden space-y-4 pt-10 break-inside-avoid print:block">
          <div className="ml-auto w-64 text-center">
            <div className="mb-1 border-t border-slate-500" />
            <p className="text-xs font-bold uppercase text-[#163C68]">Firma y sello del profesional</p>
          </div>
          <PrintBrandStrip />
          <p className="text-[9px] text-slate-500">
            Contiene datos personales protegidos por la Ley 25.326. Uso exclusivo del área. Ref. {referencia}.
          </p>
        </footer>
      </article>
    </div>
  );
}
