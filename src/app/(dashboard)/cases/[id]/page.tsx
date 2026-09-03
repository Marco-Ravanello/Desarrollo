export const dynamic = "force-dynamic";
import { getCaseById } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound, redirect } from "next/navigation";
import { Calendar, User, MapPin, Tag, ArrowLeft, ShieldAlert, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { QuickInterventionForm } from "./quick-intervention-form";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const caseData = await getCaseById(id);

  if (!caseData) notFound();

  // Validar permiso para casos sensibles
  if (caseData.area.name === "Violencia de Género") {
    const canView = hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES);
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-xl">
          <Link href={`/people/${caseData.personId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">{caseData.title}</h2>
          <div className="flex items-center gap-2 mt-1">
             <Badge variant={isClosed ? 'secondary' : 'default'} className="font-bold uppercase text-[10px]">{caseData.status}</Badge>
             <span className="text-muted-foreground text-sm font-semibold">{caseData.area.name}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-border/60 shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground">Descripción del Caso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{caseData.description || "Sin descripción adicional."}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60 shadow-sm bg-card space-y-4 p-6">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Evolución e Intervenciones</CardTitle>
                <CardDescription>Registro cronológico de acciones tomadas.</CardDescription>
              </div>
            </div>

            {!isClosed && (
              <QuickInterventionForm caseId={caseData.id} caseTitle={caseData.title} />
            )}

            <CardContent className="px-0 pt-2">
              {caseData.interventions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6 border border-dashed border-border/60 rounded-2xl font-medium">No hay intervenciones registradas en este expediente.</p>
              ) : (
                <div className="space-y-3">
                  {caseData.interventions.map((int) => (
                    <div key={int.id} className="flex gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20 hover:border-border transition-colors">
                       <div className="text-[11px] font-mono font-bold text-muted-foreground min-w-[120px] border-r border-border/40 pr-3 flex flex-col justify-center">
                          <span>{new Date(int.date).toLocaleDateString('es-AR')}</span>
                          <span className="text-[10px] opacity-70">{new Date(int.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <div className="text-sm text-foreground font-medium whitespace-pre-wrap flex-1">{int.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-border/60 shadow-sm bg-card">
            <CardHeader><CardTitle className="text-lg font-bold text-foreground">Información del Ciudadano</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Link href={`/people/${caseData.personId}`} className="font-bold text-foreground hover:underline">
                  {caseData.person.lastName}, {caseData.person.firstName}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                <Tag className="h-4 w-4 text-muted-foreground" /> DNI {caseData.person.dni}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                <MapPin className="h-4 w-4 text-muted-foreground" /> {caseData.person.address || 'Sin dirección'}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60 shadow-sm bg-card">
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
