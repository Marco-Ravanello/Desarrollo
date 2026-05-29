export const dynamic = "force-dynamic";
import { getPersonById } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, MapPin, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userRole = session?.user?.role;

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  // Filtrar casos sensibles si no tiene permisos
  const visibleCases = person.cases.filter(c => {
    if (c.area.name === "Violencia de Género") {
      return userRole === "SUPERADMIN" || userRole === "DIRECCION_GENERAL" || userRole === "VIOLENCIA_GENERO";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
          {person.firstName[0]}{person.lastName[0]}
        </div>
        <div>
          <h2 className="text-3xl font-bold">{person.lastName}, {person.firstName}</h2>
          <Badge variant="outline">DNI: {person.dni}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader><CardTitle className="text-lg">Datos de Contacto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400"/> {person.address}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400"/> {person.phone}</div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400"/> {person.birthDate?.toLocaleDateString()}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <Tabs defaultValue="cases">
            <TabsList className="m-4">
              <TabsTrigger value="cases">Casos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
            </TabsList>
            <TabsContent value="cases" className="p-4 pt-0">
              {visibleCases.length === 0 ? <p className="text-slate-500">No hay casos activos visibles.</p> : (
                <div className="space-y-2">
                  {visibleCases.map(c => (
                    <div key={c.id} className="p-3 border rounded-md flex justify-between items-center bg-white">
                      <div className="flex items-center gap-3">
                        {c.area.name === "Violencia de Género" && <ShieldAlert className="h-4 w-4 text-red-600" />}
                        <div>
                          <p className="font-bold">{c.title}</p>
                          <p className="text-xs text-slate-500">{c.area.name}</p>
                        </div>
                      </div>
                      <Badge variant={c.area.name === "Violencia de Género" ? "destructive" : "default"}>
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
