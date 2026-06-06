export const dynamic = "force-dynamic";
import { getPersonById } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, MapPin, ShieldAlert, Mail, History, Eye, FileIcon, ExternalLink, Users, UserMinus } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAreas } from "@/services/cases";
import { CreateCaseForm } from "./create-case-form";
import { UploadDocumentForm } from "./upload-document-form";
import { CloseCaseButton } from "./close-case-button";
import { AddFamilyMemberForm } from "./add-family-member-form";
import { removeFromFamily } from "../actions/family-actions";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userRole = session?.user?.role;

  const { id } = await params;
  const [person, areas] = await Promise.all([
    getPersonById(id),
    getAreas()
  ]);

  if (!person) notFound();

  // Filtrar casos sensibles si no tiene permisos
  const allowedCases = person.cases.filter(c => {
    if (c.area.name === "Violencia de Género") {
      return userRole === "SUPERADMIN" || userRole === "DIRECCION_GENERAL" || userRole === "VIOLENCIA_GENERO";
    }
    return true;
  });

  const activeCases = allowedCases.filter(c => c.status !== 'CERRADO');
  const closedCases = allowedCases.filter(c => c.status === 'CERRADO');

  // Obtener familiares (excluyendo a la persona actual)
  const familyMembers = person.family?.members.filter(m => m.id !== person.id) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-xl border-2 border-blue-200 dark:border-blue-800">
          {person.firstName[0]}{person.lastName[0]}
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">{person.lastName}, {person.firstName}</h2>
          <div className="flex gap-2 items-center mt-1">
            <Badge variant="outline" className="border-slate-300">DNI: {person.dni}</Badge>
            {person.email && <Badge variant="secondary" className="font-normal">{person.email}</Badge>}
            {person.familyId && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">En Grupo Familiar</Badge>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Datos de Contacto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-slate-400"/> {person.address}</div>
            <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-slate-400"/> {person.phone}</div>
            {person.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-slate-400"/> {person.email}</div>}
            <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-slate-400"/> {person.birthDate?.toLocaleDateString() || 'No registrada'}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-none shadow-sm">
          <Tabs defaultValue="cases">
            <TabsList className="m-4 bg-muted/50 p-1">
              <TabsTrigger value="cases">Casos</TabsTrigger>
              <TabsTrigger value="family">Familia</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="cases" className="p-4 pt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Casos Activos</h3>
              </div>
              {activeCases.length === 0 ? <p className="text-muted-foreground text-sm py-4 text-center border rounded-lg border-dashed">No hay casos activos.</p> : (
                <div className="space-y-3">
                  {activeCases.map(c => (
                    <div key={c.id} className="p-4 border rounded-lg flex justify-between items-center bg-card shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${c.area.name === "Violencia de Género" ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"}`}>
                           {c.area.name === "Violencia de Género" ? <ShieldAlert className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-none">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.area.name} • {c.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" asChild>
                           <Link href={`/cases/${c.id}`}><Eye className="h-4 w-4" /></Link>
                         </Button>
                         <CloseCaseButton caseId={c.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <CreateCaseForm personId={person.id} areas={areas} />
            </TabsContent>

            <TabsContent value="family" className="p-4 pt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Composición Familiar</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {familyMembers.length === 0 && !person.familyId && (
                  <div className="md:col-span-2 flex flex-col items-center justify-center py-8 text-muted-foreground border rounded-lg border-dashed">
                    <Users className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm text-center">No se han registrado vínculos familiares.</p>
                  </div>
                )}

                {familyMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:border-blue-400 transition-colors">
                    <Link href={`/people/${m.id}`} className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate">{m.firstName} {m.lastName}</span>
                        <span className="text-[10px] text-muted-foreground">DNI: {m.dni}</span>
                      </div>
                    </Link>
                    <form action={async () => { "use server"; await removeFromFamily(m.id); }}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>

              <AddFamilyMemberForm personId={person.id} />
            </TabsContent>

            <TabsContent value="history" className="p-4 pt-0">
               <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Historial de Casos Cerrados</h3>
              </div>
              {closedCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No hay casos cerrados aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closedCases.map(c => (
                    <div key={c.id} className="p-4 border rounded-lg flex justify-between items-center bg-muted/30 grayscale opacity-80">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                           <History className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-none">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.area.name} • Finalizado el {new Date(c.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                           <Link href={`/cases/${c.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Badge variant="outline" className="text-slate-500 uppercase text-[10px]">Cerrado</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="docs" className="p-4 pt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Documentación Adjunta</h3>
              </div>
              {person.documents.length === 0 ? <p className="text-muted-foreground text-center py-4 border rounded-md border-dashed">No hay documentos adjuntos.</p> : (
                <div className="grid grid-cols-1 gap-2">
                  {person.documents.map(d => (
                    <div key={d.id} className="p-3 border rounded-md flex justify-between items-center bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-sm text-foreground">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/api${d.url}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <UploadDocumentForm personId={person.id} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
