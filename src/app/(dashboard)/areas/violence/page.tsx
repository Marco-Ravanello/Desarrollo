export const dynamic = "force-dynamic";
import { getCasesByArea } from "@/services/cases";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShieldAlert, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function ViolenceModulePage() {
  const session = await auth();
  const role = session?.user?.role;

  if (!role || !hasPermission(role as any, PERMISSIONS.VIEW_SENSITIVE_CASES)) {
    redirect("/dashboard");
  }

  const cases = await getCasesByArea("Violencia de Género");

  return (
    <div className="space-y-6">
      <div className="bg-destructive/10 border border-destructive/30 p-6 rounded-3xl flex items-center gap-4 text-destructive">
        <ShieldAlert className="h-10 w-10 text-rose-500 shrink-0"/>
        <div>
          <h2 className="text-2xl font-black tracking-tight">Área de Violencia y Género</h2>
          <p className="font-bold text-xs uppercase tracking-wider opacity-90">ACCESO RESTRINGIDO - INFORMACIÓN SENSIBLE</p>
        </div>
      </div>

      <div className="border border-border/60 rounded-3xl bg-card text-card-foreground overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/40">
              <TableHead className="font-bold">Caso</TableHead>
              <TableHead className="font-bold">Prioridad</TableHead>
              <TableHead className="font-bold">Estado</TableHead>
              <TableHead className="text-right font-bold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/30">
            {cases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                  No hay casos registrados en el área de Violencia de Género.
                </TableCell>
              </TableRow>
            ) : (
              cases.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-bold text-foreground">{c.title}</TableCell>
                  <TableCell><Badge variant="destructive" className="font-bold text-[10px]">{c.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="font-bold text-[10px] border-border text-foreground">{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="rounded-xl">
                      <Link href={`/cases/${c.id}`}>
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground"/>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
