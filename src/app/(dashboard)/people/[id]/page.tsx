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
import { CitizenTimeline } from "@/components/timeline/citizen-timeline";
import { CloseCaseButton } from "./close-case-button";
import { AddFamilyMemberForm } from "./add-family-member-form";
import { EditPersonDialog } from "./edit-person-dialog";
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

  const isViolenceCase = (c: any) =>
    c.area?.name === "Violencia de Género" ||
    c.area?.name?.toLowerCase().includes("violencia");

  const allowedCases = person.cases.filter(c => {
    if (isViolenceCase(c)) {
      return userRole === "SUPERADMIN" || userRole === "DIRECCION_GENERAL" || userRole === "VIOLENCIA_GENERO";
    }
    return true;
  });

  const allowedCaseIds = new Set(allowedCases.map(c => c.id));

  const activeCases = allowedCases.filter(c => c.status !== 'CERRADO');
  const closedCases = allowedCases.filter(c => c.status === 'CERRADO');

  const familyMembers = person.family?.members.filter(m => m.id !== person.id) || [];

  const filteredInterventions = person.interventions.filter(i => !i.caseId || allowedCaseIds.has(i.caseId));
  const filteredDocuments = person.documents.filter(d => !d.caseId || allowedCaseIds.has(d.caseId));

  const timelineEvents: any[] = [
    ...allowedCases.map(c => ({
      id: `case-start-${c.id}`,
      type: 'CASE_CREATED',
      date: c.createdAt.toISOString(),
      title: `Apertura de Expediente: ${c.title}`,
      area: c.area.name,
      description: c.description
    })),
    ...allowedCases.filter(c => c.status === 'CERRADO').map(c => ({
        id: `case-end-${c.id}`,
        type: 'CASE_CLOSED',
        date: c.updatedAt.toISOString(),
        title: `Cierre de Caso: ${c.title}`,
        area: c.area.name
    })),
    ...filteredInterventions.map(i => ({
      id: i.id,
      type: 'INTERVENTION',
      date: i.date.toISOString(),
      title: `Intervención Social`,
      description: i.description
    })),
    ...filteredDocuments.map(d => ({
        id: d.id,
        type: 'DOCUMENT',
        date: d.createdAt.toISOString(),
        title: `Documento Adjuntado: ${d.name}`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center font-bold text-xl border-2 border-blue-500/30">
            {person.firstName[0]}{person.lastName[0]}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{person.lastName}, {person.firstName}</h2>
            <div className="flex gap-2 items-center mt-1">
              <Badge variant="outline" className="border-border text-foreground font-mono">DNI: {person.dni}</Badge>
              {person.email && <Badge variant="secondary" className="font-normal">{person.email}</Badge>}
              {person.familyId && <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-xs">En Grupo Familiar</Badge>}
            </div>
          </div>
        </div>

        <EditPersonDialog person={person} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="col-span-1 border border-border/60 shadow-xs bg-card text-card-foreground rounded-3xl">
          <CardHeader><CardTitle className="text-lg font-black text-foreground">Datos de Contacto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-foreground"><MapPin className="h-4 w-4 text-muted-foreground"/> {person.address || 'Sin dirección'}</div>
            <div className="flex items-center gap-2 text-sm text-foreground"><Phone className="h-4 w-4 text-muted-foreground"/> {person.phone || 'Sin teléfono'}</div>
            {person.email && <div className="flex items-center gap-2 text-sm text-foreground"><Mail className="h-4 w-4 text-muted-foreground"/> {person.email}</div>}
            <div className="flex items-center gap-2 text-sm text-foreground"><Calendar className="h-4 w-4 text-muted-foreground"/> {person.birthDate?.toLocaleDateString('es-AR') || 'No registrada'}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border border-border/60 shadow-xs bg-card text-card-foreground rounded-3xl overflow-hidden">
          <Tabs defaultValue="timeline">
            <TabsList className="m-4 bg-muted/40 p-1 border border-border/40 rounded-2xl">
              <TabsTrigger value="timeline" className="rounded-xl text-xs font-bold uppercase tracking-wider">Línea de Tiempo</TabsTrigger>
              <TabsTrigger value="cases" className="rounded-xl text-xs font-bold uppercase tracking-wider">Casos</TabsTrigger>
              <TabsTrigger value="family" className="rounded-xl text-xs font-bold uppercase tracking-wider">Familia</TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl text-xs font-bold uppercase tracking-wider">Historial</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl text-xs font-bold uppercase tracking-wider">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="p-6 pt-0">
               <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                   <History className="h-4 w-4" /> Evolución del Ciudadano
                </h3>
              </div>
              <CitizenTimeline events={timelineEvents} />
            </TabsContent>

            <TabsContent value="cases" className="p-4 pt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Casos Activos</h3>
              </div>
              {activeCases.length === 0 ? <p className="text-muted-foreground text-sm py-4 text-center border rounded-2xl border-dashed border-border/60">No hay casos activos.</p> : (
                <div className="space-y-3">
                  {activeCases.map(c => (
                    <div key={c.id} className="p-4 border border-border/60 rounded-2xl flex justify-between items-center bg-muted/20 shadow-xs hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${isViolenceCase(c) ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"}`}>
                           {isViolenceCase(c) ? <ShieldAlert className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-none">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.area.name} • {c.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" asChild>
                           <Link href={`/cases/${c.id}`}><Eye className="h-4 w-4 text-muted-foreground" /></Link>
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
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Composición Familiar</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {familyMembers.length === 0 && !person.familyId && (
                  <div className="md:col-span-2 flex flex-col items-center justify-center py-8 text-muted-foreground border rounded-2xl border-dashed border-border/60">
                    <Users className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm text-center font-medium">No se han registrado vínculos familiares.</p>
                  </div>
                )}

                {familyMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 border border-border/60 rounded-2xl bg-muted/20 hover:border-primary/50 transition-colors">
                    <Link href={`/people/${m.id}`} className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center text-xs font-bold text-foreground">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate text-foreground">{m.firstName} {m.lastName}</span>
                        <span className="text-[10px] text-muted-foreground">DNI: {m.dni}</span>
                      </div>
                    </Link>
                    <form action={async () => { "use server"; await removeFromFamily(m.id); }}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
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
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Historial de Casos Cerrados</h3>
              </div>
              {closedCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No hay casos cerrados aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closedCases.map(c => (
                    <div key={c.id} className="p-4 border border-border/60 rounded-2xl flex justify-between items-center bg-muted/20 opacity-80">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-muted text-muted-foreground">
                           <History className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-none">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.area.name} • Finalizado el {new Date(c.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                           <Link href={`/cases/${c.id}`}><Eye className="h-4 w-4 text-muted-foreground" /></Link>
                        </Button>
                        <Badge variant="outline" className="text-muted-foreground uppercase text-[10px]">Cerrado</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="docs" className="p-4 pt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Documentación Adjunta</h3>
              </div>
              {filteredDocuments.length === 0 ? <p className="text-muted-foreground text-center text-sm py-4 border rounded-2xl border-dashed border-border/60 font-medium">No hay documentos adjuntos.</p> : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredDocuments.map(d => (
                    <div key={d.id} className="p-3 border border-border/60 rounded-2xl flex justify-between items-center bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-foreground">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
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
