export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { auth } from "@/auth";
import { canAssignProgramArea } from "@/lib/program-ownership";
import { formatNumber, plural } from "@/lib/formato";
import { getAreaShortName } from "@/lib/area-theme";
import { getProgramSummaries } from "@/services/programs";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Programas" };

export default async function ProgramsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const programs = await getProgramSummaries();
  const canAssign = canAssignProgramArea(session.user.role);
  const withoutArea = programs.filter((p) => !p.owner).length;
  const myArea = session.user.areaId;
  const total = programs.reduce((a, p) => a + p.people, 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Registro Único", href: "/people" },
          { label: "Programas", active: true },
        ]}
      />
      <PageHeader
        title="Programas"
        description="Cuántas personas tiene hoy cada programa del padrón y qué área lo tiene a cargo. Tocá un programa para ver sus barrios, sus altas y bajas y la lista de personas."
        icon={Layers}
        actions={
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
            <Link href="/people" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      {canAssign && withoutArea > 0 && (
        <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          {withoutArea === 1 ? "Hay 1 programa sin área a cargo." : `Hay ${withoutArea} programas sin área a cargo.`}{" "}
          Mientras no tengan área, cualquiera que carga datos les puede dar altas y bajas. El área se elige en la página de cada programa.
        </div>
      )}

      <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Programa</TableHead>
              <TableHead className="text-right">Personas hoy</TableHead>
              <TableHead>Área a cargo</TableHead>
              <TableHead className="text-right">Altas (30 días)</TableHead>
              <TableHead className="text-right">Bajas (30 días)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.map((p) => (
              <TableRow key={p.column}>
                <TableCell className="font-semibold">
                  <Link href={`/people/programas/${p.slug}`} className="text-foreground hover:text-primary hover:underline">
                    {p.label}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(p.people)}</TableCell>
                <TableCell>
                  {p.owner ? (
                    <span className={p.owner.areaId === myArea ? "font-semibold text-primary dark:text-blue-300" : "text-foreground"}>
                      {getAreaShortName(p.owner.areaName)}
                      {p.owner.areaId === myArea && <span className="font-normal text-muted-foreground"> (tu área)</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sin área a cargo</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(p.altas)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(p.bajas)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Entre todos los programas suman {plural(total, "participación", "participaciones")}: una persona que está en dos programas se cuenta en los dos.
      </p>
    </div>
  );
}
