export const dynamic = "force-dynamic";
import { getCasesByArea } from "@/services/cases";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShieldAlert, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ViolenceModulePage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role !== "SUPERADMIN" && role !== "DIRECCION_GENERAL" && role !== "VIOLENCIA_GENERO") {
    redirect("/dashboard");
  }

  const cases = await getCasesByArea("Violencia de Género");

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 p-6 rounded-lg flex items-center gap-4">
        <ShieldAlert className="h-10 w-10 text-red-600"/>
        <div>
          <h2 className="text-2xl font-bold text-red-900">Área de Violencia y Género</h2>
          <p className="text-red-700 font-medium">ACCESO RESTRINGIDO - INFORMACIÓN SENSIBLE</p>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Caso</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold">{c.title}</TableCell>
                <TableCell><Badge variant="destructive">{c.priority}</Badge></TableCell>
                <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon"><Eye className="h-4 w-4"/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
