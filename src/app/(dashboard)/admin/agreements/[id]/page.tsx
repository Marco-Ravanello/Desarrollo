export const dynamic = "force-dynamic";
import { getAgreementById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, Building2, User, FileText, Info, Landmark, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";
import { formatFechaCalendario, formatFechaHora } from "@/lib/fechas";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { agreementState } from "@/lib/convenios";
import { AgreementEndLabel, AgreementStatusBadge } from "@/components/agreements/agreement-status";
import { agreementTitle } from "@/lib/page-titles";

export const generateMetadata = agreementTitle;

export default async function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agreement = await getAgreementById(id);

  if (!agreement) {
    notFound();
  }
  const state = agreementState(agreement, todayInArgentina());
  const amount = agreement.amount !== null ? Number(agreement.amount) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={agreement.title}
        description={agreement.number ? <>Convenio N° {agreement.number}</> : "Todavía sin número de convenio"}
        icon={Landmark}
        actions={
          <>
            <AgreementStatusBadge state={state} className="px-4 py-1 text-sm" />
            <Button variant="outline" size="icon" asChild>
              <Link href="/admin/agreements" aria-label="Volver a convenios">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-emerald-500" />
              Datos del convenio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-xs text-muted-foreground font-bold">Partes: con quién se firma</Label>
              <p className="text-lg font-medium text-foreground">{agreement.parties || "Sin partes cargadas"}</p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs text-muted-foreground font-bold">Detalles</Label>
              <div className="bg-muted/50 p-4 rounded-xl text-foreground whitespace-pre-wrap min-h-[100px]">
                {agreement.description || "Sin detalles cargados."}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground font-bold">Vigencia</Label>
                  <p className="font-medium">
                    {agreement.startDate && agreement.endDate
                      ? `Del ${formatFechaCalendario(agreement.startDate)} al ${formatFechaCalendario(agreement.endDate)}`
                      : agreement.startDate
                      ? `Desde el ${formatFechaCalendario(agreement.startDate)}, sin fecha de fin`
                      : agreement.endDate
                      ? `Hasta el ${formatFechaCalendario(agreement.endDate)}`
                      : "Sin fechas cargadas"}
                  </p>
                  <p className="mt-1 text-sm">
                    <AgreementEndLabel state={state} />
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground font-bold">Área responsable</Label>
                  <p className="font-medium">{agreement.area?.name || "Sin área"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <StatCard
            label="Monto del convenio"
            value={amount > 0 ? `$${amount.toLocaleString("es-AR")}` : "Sin monto"}
            hint={amount > 0 ? "Monto total firmado" : "No tiene un monto cargado"}
            icon={Wallet}
            tone="green"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-bold text-muted-foreground">Documentación</CardTitle>
            </CardHeader>
            <CardContent>
               {agreement.fileUrl ? (
                 <Button className="w-full" asChild>
                   <a href={agreement.fileUrl} target="_blank" rel="noopener noreferrer">
                     <FileText className="mr-2 h-4 w-4" /> Ver documento original
                   </a>
                 </Button>
               ) : (
                 <EmptyMessage
                   icon={FileText}
                   compact
                   title="Este convenio todavía no tiene archivo adjunto"
                   className="rounded-xl border-2 border-dashed"
                 />
               )}
            </CardContent>
          </Card>

          <p className="px-1 text-xs text-muted-foreground">
            Cargado el {formatFechaHora(agreement.createdAt)}
            {agreement.updatedAt.getTime() - agreement.createdAt.getTime() > 1000 && <> · Último cambio: {formatFechaHora(agreement.updatedAt)}</>}
          </p>
        </div>
      </div>
    </div>
  );
}
