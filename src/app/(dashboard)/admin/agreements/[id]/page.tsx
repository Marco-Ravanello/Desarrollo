export const dynamic = "force-dynamic";
import { getAgreementById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, Building2, User, FileText, Info } from "lucide-react";
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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/agreements">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{agreement.title}</h2>
          <p className="text-slate-500">Número de Registro: {agreement.number || "---"}</p>
        </div>
        <Badge
          className="ml-auto text-lg px-4 py-1"
          variant={agreement.status === 'VIGENTE' ? 'default' : 'secondary'}
        >
          {agreement.status}
        </Badge>
      </div>

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
              <p className="text-lg font-medium text-slate-800">{agreement.parties || "No especificado"}</p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Descripción / Objeto</Label>
              <div className="bg-slate-50 p-4 rounded-xl text-slate-700 whitespace-pre-wrap min-h-[100px]">
                {agreement.description || "Sin descripción detallada."}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
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
                <Building2 className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Área Responsable</Label>
                  <p className="font-medium">{agreement.area?.name || "Global / Sin especificar"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-emerald-50/50 border-emerald-100">
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-emerald-600 tracking-widest">Impacto Presupuestario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-emerald-700">
                ${agreement.amount ? Number(agreement.amount).toLocaleString('es-AR') : "0"}
              </p>
              <p className="text-[10px] text-emerald-600/70 uppercase mt-1">Monto total del convenio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-widest">Documentación</CardTitle>
            </CardHeader>
            <CardContent>
               {agreement.fileUrl ? (
                 <Button className="w-full" asChild>
                   <a href={agreement.fileUrl} target="_blank" rel="noopener noreferrer">
                     <FileText className="mr-2 h-4 w-4" /> Ver Documento Original
                   </a>
                 </Button>
               ) : (
                 <div className="text-center py-4 border-2 border-dashed rounded-xl text-slate-400 italic text-sm">
                   No hay archivo adjunto.
                 </div>
               )}
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-widest">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-slate-400 space-y-1">
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
