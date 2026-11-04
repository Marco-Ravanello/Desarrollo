export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Edit } from "lucide-react";
import { auth } from "@/auth";
import { canEditHR, canViewHR, hrStatusLabel } from "@/lib/hr-labels";
import { HR_STATUS_TONE, toneOf } from "@/lib/status-tones";
import { initialsColor, initialsOf } from "@/lib/initials";
import { getHRRecordById } from "@/services/hr";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PrintButton } from "@/components/ui/print-layout";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { HRRecordView } from "../view-hr-detail";
import { LeavesSection } from "./leaves-section";
import { getLeavesFor } from "@/services/hr-leaves";
import { dateToDay, yearSummary } from "@/lib/hr-leaves";
import { diaAR } from "@/lib/fechas";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getHRRecordById(id).catch(() => null);
  return { title: agent ? `Legajo de ${agent.firstName} ${agent.lastName}` : "Legajo" };
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canViewHR(session.user.role)) redirect("/dashboard");
  const { id } = await params;
  const [agent, leaves] = await Promise.all([getHRRecordById(id), getLeavesFor(id)]);
  if (!agent) notFound();
  const today = diaAR();
  const year = Number(today.slice(0, 4));
  const canEdit = canEditHR(session.user.role);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Recursos" },
          { label: "Recursos Humanos", href: "/admin/hr" },
          { label: `${agent.firstName} ${agent.lastName}`, active: true },
        ]}
      />
      <PageHeader
        leading={
          <Avatar className="h-14 w-14 rounded-2xl">
            <AvatarImage src={agent.imageUrl || ""} alt={agent.firstName} className="object-cover" />
            <AvatarFallback className={`rounded-2xl text-lg font-bold ${initialsColor(agent.dni || agent.id)}`}>
              {initialsOf(agent.firstName, agent.lastName)}
            </AvatarFallback>
          </Avatar>
        }
        title={`${agent.firstName} ${agent.lastName}`}
        description={`DNI ${agent.dni} · ${agent.fileNumber ? `Legajo N° ${agent.fileNumber}` : "Sin N° de legajo"}`}
        badge={<StatusBadge tone={toneOf(HR_STATUS_TONE, agent.status || "ACTIVO")}>{hrStatusLabel(agent.status)}</StatusBadge>}
        actions={
          <>
            <PrintButton label="Imprimir legajo" />
            {canEdit && (
              <Button asChild className="gap-1.5 print:hidden">
                <Link href={`/admin/hr/${agent.id}/editar`}>
                  <Edit className="h-4 w-4" /> Editar legajo
                </Link>
              </Button>
            )}
          </>
        }
      />
      <HRRecordView
        agent={{ ...agent, salary: agent.salary ? Number(agent.salary) : null }}
        leaves={
          <LeavesSection
            agentId={agent.id}
            leaves={leaves.map((l) => ({ id: l.id, kind: l.kind, notes: l.notes, startDate: dateToDay(l.startDate), endDate: dateToDay(l.endDate) }))}
            today={today}
            year={year}
            summary={yearSummary(leaves, year)}
            canEdit={canEdit}
          />
        }
      />
    </div>
  );
}
