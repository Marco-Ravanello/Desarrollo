export const dynamic = "force-dynamic";
import { getPeople } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";

export default async function PeoplePage() {
  const people = await getPeople();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Registro Único</h2>
          <p className="text-slate-500">Gestione la base de datos centralizada de personas y familias.</p>
        </div>
        <Button asChild><Link href="/people/new"><Plus className="mr-2 h-4 w-4"/> Nueva Persona</Link></Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Apellido y Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Casos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.lastName}, {p.firstName}</TableCell>
                <TableCell>{p.dni}</TableCell>
                <TableCell><Badge variant="outline">{p._count.cases}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/people/${p.id}`}><Eye className="h-4 w-4"/></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
