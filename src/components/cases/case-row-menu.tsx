"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Copy, ExternalLink, FolderOpen, Hand, UserCog, UserRound } from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AssignCaseControl, type AssignOption } from "@/components/cases/assign-case";
import { ScheduleFollowUpButton } from "@/components/cases/follow-ups";
import { CloseReopenCaseButton } from "@/components/cases/close-reopen-case";
import { assignCaseAction, getCaseAssignOptionsAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { copyText } from "@/components/ui/copy-text";
import { TABLE_ROW_CLASS } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AssignData = { options: AssignOption[]; assigneeId: string | null; areaLabel: string };

/**
 * Fila de la lista de expedientes con menú del botón derecho (idea 154): abrir, abrir en otra pestaña,
 * ver la ficha, copiar el DNI y, según lo que pueda hacer cada persona, tomarlo, asignarlo, agendar un
 * seguimiento o cerrarlo, sin entrar al expediente.
 */
export function CaseRowMenu({
  caseId,
  title,
  personHref,
  personDni,
  currentUserId,
  today,
  canClose,
  canFollowUp,
  canAssign,
  canTake,
  className,
  children,
}: {
  caseId: string;
  title: string;
  personHref: string | null;
  personDni: string | null;
  currentUserId: string;
  today: string;
  canClose: boolean;
  canFollowUp: boolean;
  canAssign: boolean;
  /** Puede tomarlo (es del área y no tiene a nadie a cargo). */
  canTake: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const href = `/cases/${caseId}`;
  const [dialog, setDialog] = useState<null | "assign" | "followUp" | "close">(null);
  const [assignData, setAssignData] = useState<AssignData | null>(null);

  const openAssign = async () => {
    const res = await getCaseAssignOptionsAction(caseId).catch(() => null);
    if (!res?.success) return toast.error(res?.error || "No se pudo cargar la lista. Probá de nuevo.");
    setAssignData({ options: res.options, assigneeId: res.assigneeId, areaLabel: res.areaLabel });
    setDialog("assign");
  };

  const take = async () => {
    const res = await assignCaseAction(caseId, currentUserId).catch(() => null);
    if (!res?.success) return toast.error((res as { error?: string } | null)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Quedaste a cargo del expediente.");
    router.refresh();
  };

  const hasActions = canTake || canAssign || canFollowUp || canClose;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr className={cn(TABLE_ROW_CLASS, "data-[state=open]:bg-muted/60", className)} data-row-menu="expediente">
            {children}
          </tr>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label={`Acciones de ${title}`}>
          <ContextMenuLabel>{title}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => router.push(href)}>
            <FolderOpen /> Abrir expediente
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => window.open(href, "_blank", "noopener")}>
            <ExternalLink /> Abrir en otra pestaña
          </ContextMenuItem>
          {personHref && (
            <ContextMenuItem onSelect={() => router.push(personHref)}>
              <UserRound /> Ver ficha del titular
            </ContextMenuItem>
          )}
          {personDni && (
            <ContextMenuItem onSelect={() => copyText(personDni, "DNI copiado.")}>
              <Copy /> Copiar DNI del titular
            </ContextMenuItem>
          )}
          {hasActions && <ContextMenuSeparator />}
          {canTake && (
            <ContextMenuItem onSelect={take}>
              <Hand /> Lo tomo yo
            </ContextMenuItem>
          )}
          {canAssign && (
            <ContextMenuItem onSelect={openAssign}>
              <UserCog /> Asignar o cambiar profesional…
            </ContextMenuItem>
          )}
          {canFollowUp && (
            <ContextMenuItem onSelect={() => setDialog("followUp")}>
              <CalendarClock /> Agendar seguimiento…
            </ContextMenuItem>
          )}
          {canClose && (
            <ContextMenuItem onSelect={() => setDialog("close")}>
              <CheckCircle2 /> Cerrar expediente…
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {canAssign && assignData && (
        <AssignCaseControl
          caseId={caseId}
          areaLabel={assignData.areaLabel}
          assigneeId={assignData.assigneeId}
          canAssign
          canTake={false}
          currentUserId={currentUserId}
          options={assignData.options}
          open={dialog === "assign"}
          onOpenChange={(o) => setDialog(o ? "assign" : null)}
        />
      )}
      {canFollowUp && (
        <ScheduleFollowUpButton caseId={caseId} today={today} open={dialog === "followUp"} onOpenChange={(o) => setDialog(o ? "followUp" : null)} />
      )}
      {canClose && (
        <CloseReopenCaseButton caseId={caseId} mode="close" open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} />
      )}
    </>
  );
}
