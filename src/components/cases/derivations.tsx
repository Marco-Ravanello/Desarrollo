"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Check, Loader2, Send, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createDerivationAction, respondDerivationAction } from "@/app/(dashboard)/cases/actions/case-actions";
import type { DerivationRow } from "@/services/derivations";
import { formatFecha } from "@/lib/fechas";

const fecha = formatFecha;

const ESTADO: Record<DerivationRow["status"], { label: string; className: string }> = {
  PENDIENTE: { label: "Esperando respuesta", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30" },
  ACEPTADA: { label: "Aceptada", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  RECHAZADA: { label: "Rechazada", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  COMPLETADA: { label: "Completada", className: "bg-muted text-muted-foreground border-border/60" },
};

const selectClass =
  "flex h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export function DeriveCaseButton({
  caseId,
  areas,
  currentAreaId,
  triggerClassName = "w-full",
}: {
  caseId: string;
  areas: { id: string; name: string }[];
  currentAreaId: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toAreaId, setToAreaId] = useState("");
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAreaId) return toast.error("Elegí el área a la que lo derivás.");
    if (!reason.trim()) return toast.error("Escribí el motivo de la derivación.");
    setSaving(true);
    const res = await createDerivationAction(caseId, toAreaId, reason, observations).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo derivar. Probá de nuevo.");
    toast.success("Expediente derivado. El área va a recibir el aviso.");
    setOpen(false);
    setToAreaId("");
    setReason("");
    setObservations("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`${triggerClassName} rounded-xl font-bold gap-2`}>
          <ArrowRightLeft className="h-4 w-4" /> Derivar a otra área
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Derivar expediente</DialogTitle>
            <DialogDescription>
              El área elegida recibe un aviso y decide si lo acepta. Hasta que responda, el expediente sigue siendo de tu área.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="deriv-area" className="text-xs font-bold">Área que lo recibe</Label>
            <select id="deriv-area" value={toAreaId} onChange={(e) => setToAreaId(e.target.value)} className={selectClass} required>
              <option value="">Elegí un área…</option>
              {areas.filter((a) => a.id !== currentAreaId).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deriv-reason" className="text-xs font-bold">Motivo</Label>
            <Textarea id="deriv-reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="rounded-xl text-sm" placeholder="Por qué lo tiene que tomar esa área" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deriv-obs" className="text-xs font-bold">Observaciones (opcional)</Label>
            <Textarea id="deriv-obs" value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="rounded-xl text-sm" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Derivar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DerivationAnswer({ derivationId }: { derivationId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState<"accept" | "reject" | null>(null);

  const answer = async (accept: boolean) => {
    if (!accept && !response.trim()) return toast.error("Escribí el motivo del rechazo.");
    setSaving(accept ? "accept" : "reject");
    const res = await respondDerivationAction(derivationId, accept, accept ? undefined : response).catch(() => null);
    setSaving(null);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo responder. Probá de nuevo.");
    toast.success(accept ? "Derivación aceptada. El expediente ahora es de tu área." : "Derivación rechazada. El expediente volvió al área que lo derivó.");
    router.refresh();
  };

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`rechazo-${derivationId}`} className="text-xs font-bold">Motivo del rechazo</Label>
        <Textarea
          id={`rechazo-${derivationId}`}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={2}
          className="rounded-xl text-sm"
          placeholder="Por qué no corresponde a tu área"
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="destructive" disabled={saving !== null} onClick={() => answer(false)} className="rounded-xl font-bold gap-1.5">
            {saving === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Confirmar rechazo
          </Button>
          <Button size="sm" variant="ghost" disabled={saving !== null} onClick={() => setRejecting(false)} className="rounded-xl font-bold">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={saving !== null} onClick={() => answer(true)} className="rounded-xl font-bold gap-1.5">
        {saving === "accept" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aceptar
      </Button>
      <Button size="sm" variant="outline" disabled={saving !== null} onClick={() => setRejecting(true)} className="rounded-xl font-bold gap-1.5">
        <X className="h-3.5 w-3.5" /> Rechazar
      </Button>
    </div>
  );
}

export function DerivationCard({ d, canRespond, showCase }: { d: DerivationRow; canRespond: boolean; showCase?: boolean }) {
  const estado = ESTADO[d.status];
  return (
    <div className={`rounded-2xl border p-4 space-y-2.5 ${d.status === "PENDIENTE" ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/20"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showCase && (
            <Link href={`/cases/${d.caseId}`} className="block text-sm font-bold text-foreground hover:underline leading-snug">
              {d.caseTitle}
            </Link>
          )}
          {showCase && d.person && <p className="text-xs text-muted-foreground">{d.person}</p>}
          <p className="text-xs font-bold text-foreground mt-0.5">
            {d.fromArea} <ArrowRightLeft className="inline h-3 w-3 mx-1 text-muted-foreground" /> {d.toArea}
          </p>
          <p className="text-xs text-muted-foreground">
            Derivado el {fecha(d.createdAt)}{d.createdBy ? ` por ${d.createdBy}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs font-bold ${estado.className}`}>
          {d.status === "PENDIENTE" && <Clock className="h-3 w-3 mr-1" />}
          {estado.label}
        </Badge>
      </div>
      <p className="text-xs text-foreground whitespace-pre-line"><span className="font-semibold text-muted-foreground">Motivo:</span> {d.reason}</p>
      {d.observations && <p className="text-xs text-foreground whitespace-pre-line"><span className="font-semibold text-muted-foreground">Observaciones:</span> {d.observations}</p>}
      {d.respondedAt && (
        <p className="text-xs text-foreground whitespace-pre-line">
          <span className="font-semibold text-muted-foreground">
            {d.status === "RECHAZADA" ? "Rechazada" : "Aceptada"} el {fecha(d.respondedAt)}{d.respondedBy ? ` por ${d.respondedBy}` : ""}
            {d.response ? ":" : "."}
          </span>{" "}
          {d.response}
        </p>
      )}
      {d.status === "PENDIENTE" && canRespond && <DerivationAnswer derivationId={d.id} />}
      {d.status === "PENDIENTE" && !canRespond && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Esperando que {d.toArea} la acepte o la rechace.</p>
      )}
    </div>
  );
}
