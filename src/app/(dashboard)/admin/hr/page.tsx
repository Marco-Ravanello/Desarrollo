export const dynamic = "force-dynamic";
import { getHRRecords } from "@/services/hr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateHRForm } from "./create-hr-form";

export default async function HRPage() {
  const records = await getHRRecords();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Recursos Humanos</h2>
        <p className="text-slate-500">Gestión de legajos y personal municipal.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateHRForm />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nómina de Personal</CardTitle>
            <CardDescription>Lista de agentes municipales registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No hay legajos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {r.firstName[0]}{r.lastName[0]}
                          </div>
                          <div>
                            <p className="font-bold">{r.lastName}, {r.firstName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">DNI: {r.dni}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.position}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {r.startDate ? new Date(r.startDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{r.status || 'ACTIVO'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
