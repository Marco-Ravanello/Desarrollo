export const dynamic = "force-dynamic";
import { getAgreementById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, Building2, FileText, Info, Landmark, Wallet, Clock, Gauge, History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";
import { formatFechaCalendario, formatFechaHora } from "@/lib/fechas";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { agreementState } from "@/lib/convenios";
import { AgreementEndLabel, AgreementStatusBadge } from "@/components/agreements/agreement-status";
import { agreementTitle } from "@/lib/page-titles";
import { auth } from "@/auth";
import { NIVELES, canConfigureCost, canViewCostDetail, periodoTexto } from "@/lib/convenio-gasto";
import { formatPercent, formatPesos } from "@/lib/formato";
import { getConvenioControl, getResumenPeriodo, periodoPedido } from "@/services/convenio-gasto";
import { getAgreementHistory } from "@/services/convenio-ficha";
import { ChangeAgreementStatusButton, EditAgreementButton } from "@/components/agreements/agreement-edit";
import prisma from "@/lib/prisma";

export const generateMetadata = agreementTitle;

export default async function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agreement = await getAgreementById(id);

  if (!agreement) {
    notFound();
  }
  const today = todayInArgentina();
  const state = agreementState(agreement, today);
  const amount = agreement.amount !== null ? Number(agreement.amount) : 0;

  const session = await auth();
  const user = session?.user ?? {};
  const control = await getConvenioControl(agreement.id);
  const porHora = control?.costMode === "POR_HORA";
  const resumen = control && porHora ? await getResumenPeriodo(control, periodoPedido(control, null, today), today) : null;
  const canOpenControl = control ? canViewCostDetail(user, control) : false;
  const canConfig = canConfigureCost((user as { role?: string }).role);
  const [historia, areas] = await Promise.all([
    getAgreementHistory(agreement.id),
    canConfig ? prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={agreement.title}
        description={agreement.number ? <>Convenio N° {agreement.number}</> : "Todavía sin número de convenio"}
        icon={Landmark}
        actions={
          <>
            <AgreementStatusBadge state={state} className="px-4 py-1 text-sm" />
            {canConfig && (
              <>
                <EditAgreementButton
                  areas={areas}
                  agreement={{
                    id: agreement.id,
                    title: agreement.title,
                    number: agreement.number,
                    parties: agreement.parties,
                    description: agreement.description,
                    amount: agreement.amount !== null ? Number(agreement.amount) : null,
                    startDate: isoDay(agreement.startDate),
                    endDate: isoDay(agreement.endDate),
                    areaId: agreement.areaId,
                    status: agreement.status,
                  }}
                />
                <ChangeAgreementStatusButton id={agreement.id} status={agreement.status} />
              </>
            )}
            <Button variant="outline" size="icon" asChild>
              <Link href="/admin/agreements" aria-label="Volver a convenios">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6 md:col-span-2">
        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historia.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay cambios anotados.</p>
            ) : (
              <ol className="space-y-3">
                {historia.map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm font-semibold text-foreground">{h.que}</p>
                    {h.detalle && <p className="text-sm text-foreground/80 break-words">{h.detalle}</p>}
                    <p className="text-xs text-muted-foreground">{h.quien} · {formatFechaHora(h.fecha)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="space-y-6">
          {resumen && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Gauge className="h-4 w-4 text-primary" /> Control del gasto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Período del {periodoTexto(resumen.periodo)}</p>
                <p className="text-2xl font-black tabular-nums text-foreground">{formatPesos(resumen.gastado)}</p>
                <p className="text-sm text-muted-foreground">
                  de {formatPesos(resumen.tope)}
                  {resumen.porcentaje !== null && <> · {formatPercent(resumen.porcentaje)}</>}
                  {resumen.nivel && <> · <span className="font-semibold">{NIVELES[resumen.nivel].label}</span></>}
                </p>
                {resumen.excedente > 0 && (
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Si sigue igual, se pasa del tope en {formatPesos(resumen.excedente)}.</p>
                )}
                {canOpenControl ? (
                  <Button className="w-full" asChild>
                    <Link href={`/convenios/${agreement.id}`}>Abrir el control</Link>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">El detalle lo ven la conducción, Auditoría y el área del convenio.</p>
                )}
              </CardContent>
            </Card>
          )}
          {!porHora && canConfig && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="flex items-center gap-2 text-sm font-bold"><Clock className="h-4 w-4 text-primary" /> ¿Se paga por hora?</p>
                <p className="text-xs text-muted-foreground">Cargando las horas de cada día, la app calcula lo gastado, lo que queda del tope y si se va a pasar.</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/convenios/${agreement.id}`}>Configurar el control del gasto</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <StatCard
            label="Monto del convenio"
            value={amount > 0 ? formatPesos(amount) : "Sin monto"}
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
