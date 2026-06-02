export const dynamic = "force-dynamic";
import { getCaseById } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound, redirect } from "next/navigation";
import { Calendar, User, MapPin, Tag, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

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
          <ShieldAlert className="h-16 w-16 text-red-500 animate-pulse" />
          <h2 className="text-2xl font-bold">Acceso Restringido</h2>
          <p className="text-slate-500 max-w-md">No tiene los permisos necesarios para visualizar la información de este caso debido a su naturaleza sensible.</p>
          <Button asChild variant="outline">
            <Link href="/people">Volver al Registro</Link>
          </Button>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/people/${caseData.personId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{caseData.title}</h2>
          <div className="flex items-center gap-2 mt-1">
             <Badge variant={caseData.status === 'CERRADO' ? 'secondary' : 'default'}>{caseData.status}</Badge>
             <span className="text-slate-500 text-sm">{caseData.area.name}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Descripción del Caso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{caseData.description || "Sin descripción adicional."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intervenciones</CardTitle>
              <CardDescription>Registro cronológico de acciones tomadas.</CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.interventions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No hay intervenciones registradas.</p>
              ) : (
                <div className="space-y-4">
                  {caseData.interventions.map((int) => (
                    <div key={int.id} className="flex gap-4 p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
                       <div className="text-xs text-slate-500 min-w-[100px] border-r pr-3">
                          {new Date(int.date).toLocaleString()}
                       </div>
                       <div className="text-sm">{int.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Información del Ciudadano</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <Link href={`/people/${caseData.personId}`} className="font-bold hover:underline">
                  {caseData.person.lastName}, {caseData.person.firstName}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Tag className="h-4 w-4" /> DNI {caseData.person.dni}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4" /> {caseData.person.address}
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader><CardTitle className="text-lg">Fechas</CardTitle></CardHeader>
             <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Creado</span>
                  <span>{new Date(caseData.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última actualización</span>
                  <span>{new Date(caseData.updatedAt).toLocaleDateString()}</span>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
