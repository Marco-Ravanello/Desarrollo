export const dynamic = "force-dynamic";
import { getPeople } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eye, Plus, Upload } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import InterventionsAdminPage from "../admin/interventions/page";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const people = await getPeople(search);
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-foreground">Registro Único</h2>
          <p className="text-muted-foreground text-lg">Base de datos centralizada de ciudadanos y familias.</p>
        </div>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-12 px-6 transition-all hover:bg-accent">
                <Upload className="mr-2 h-5 w-5"/> Importar
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xl w-full bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto border-l border-border">
              <SheetHeader className="mb-8">
                <SheetTitle className="text-2xl font-black">Importación Masiva</SheetTitle>
                <SheetDescription>Suba su archivo Excel para migrar intervenciones y ciudadanos.</SheetDescription>
              </SheetHeader>
              <InterventionsAdminPage />
            </SheetContent>
          </Sheet>
          <Button asChild className="rounded-2xl h-12 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105">
            <Link href="/people/new"><Plus className="mr-2 h-5 w-5"/> Nueva Persona</Link>
          </Button>
        </div>
      </div>
      <Card className="border-none shadow-sm overflow-hidden rounded-3xl bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead>Apellido y Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Casos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map(p => (
              <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
                <TableCell className="font-bold text-base">{p.lastName}, {p.firstName}</TableCell>
                <TableCell>{p.dni}</TableCell>
                <TableCell><Badge variant="secondary" className="rounded-lg font-bold">{p._count.cases} Casos</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                    <Link href={`/people/${p.id}`}><Eye className="h-5 w-5"/></Link>
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
