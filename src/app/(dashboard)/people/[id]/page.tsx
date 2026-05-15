export const dynamic = "force-dynamic";
import { getPersonById } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

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
              {person.cases.length === 0 ? <p className="text-slate-500">No hay casos activos.</p> : (
                <div className="space-y-2">
                  {person.cases.map(c => (
                    <div key={c.id} className="p-3 border rounded-md flex justify-between items-center">
                      <div><p className="font-bold">{c.title}</p><p className="text-xs text-slate-500">{c.area.name}</p></div>
                      <Badge>{c.status}</Badge>
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
