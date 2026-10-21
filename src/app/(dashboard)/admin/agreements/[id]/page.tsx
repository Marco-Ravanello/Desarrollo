export const dynamic = "force-dynamic";
import { getAgreementById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, Building2, User, FileText, Info, Landmark, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function AgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agreement = await getAgreementById(id);

  if (!agreement) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={agreement.title}
        description={<>Número de Registro: {agreement.number || "---"}</>}
        icon={Landmark}
        actions={
          <>
            <Badge
              className="text-sm px-4 py-1"
              variant={agreement.status === 'VIGENTE' ? 'default' : 'secondary'}
            >
              {agreement.status}
            </Badge>
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
              Detalles del Acuerdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Partes Intervinientes</Label>
              <p className="text-lg font-medium text-foreground">{agreement.parties || "No especificado"}</p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Descripción / Objeto</Label>
              <div className="bg-muted/50 p-4 rounded-xl text-foreground whitespace-pre-wrap min-h-[100px]">
                {agreement.description || "Sin descripción detallada."}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Vigencia</Label>
                  <p className="font-medium">
                    {agreement.startDate ? format(new Date(agreement.startDate), "dd/MM/yyyy") : "---"}
                    {" al "}
                    {agreement.endDate ? format(new Date(agreement.endDate), "dd/MM/yyyy") : "---"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Área Responsable</Label>
                  <p className="font-medium">{agreement.area?.name || "Global / Sin especificar"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <StatCard
            label="Impacto Presupuestario"
            value={<>${agreement.amount ? Number(agreement.amount).toLocaleString('es-AR') : "0"}</>}
            hint="Monto total del convenio"
            icon={Wallet}
            tone="green"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Documentación</CardTitle>
            </CardHeader>
            <CardContent>
               {agreement.fileUrl ? (
                 <Button className="w-full" asChild>
                   <a href={agreement.fileUrl} target="_blank" rel="noopener noreferrer">
                     <FileText className="mr-2 h-4 w-4" /> Ver Documento Original
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

          <Card className="bg-muted/50 border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground space-y-1">
              <p>ID Sistema: {agreement.id}</p>
              <p>Fecha Alta: {format(new Date(agreement.createdAt), "dd/MM/yyyy HH:mm")}</p>
              <p>Última Modificación: {format(new Date(agreement.updatedAt), "dd/MM/yyyy HH:mm")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
