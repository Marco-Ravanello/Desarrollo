export const dynamic = "force-dynamic";

import Link from "next/link";
import prisma from "@/lib/prisma";
import { getHRRecords, getHRStats } from "@/services/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HR_STATUS_TONE, toneOf } from "@/lib/status-tones";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, BarChart2,
  Plus, Calendar, Wallet, PieChart, UserCog
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsColor, initialsOf } from "@/lib/initials";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CreateHRForm } from "./create-hr-form";
import { AgentActionsMenu } from "./agent-actions-menu";
import { HRFilters } from "./hr-filters";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaShortName } from "@/lib/area-theme";
import { formatFechaCalendario } from "@/lib/fechas";
import { formatNumber, formatPesos, plural } from "@/lib/formato";
import { contractTypeLabel, hrStatusLabel } from "@/lib/hr-labels";

export const metadata = { title: "Recursos Humanos" };

export default async function HRPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string, area?: string, status?: string }>
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.role;
  const canAccess =
    userRole === "SUPERADMIN" ||
    userRole === "ADMIN_GENERAL" ||
    userRole === "DIRECCION_GENERAL";

  if (!canAccess) {
    redirect("/dashboard");
  }

  const { q, area, status } = await searchParams;

  const records = await getHRRecords({ query: q, areaId: area, status });
  const stats = await getHRStats();
  const areasRaw = await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });

  const sanitizedAreas = areasRaw.map(a => ({
    id: a.id,
    name: a.name,
    color: a.color
  }));

  const noSalaries = stats.withSalary === 0;
  const kpis = [
    { title: "Personal", value: formatNumber(stats.total), icon: Users, tone: "blue" as const, sub: plural(stats.active, "activo", "activos") + " hoy" },
    {
      title: "Sueldos del mes",
      value: noSalaries ? "Sin cargar" : formatPesos(stats.totalBudget),
      icon: Wallet,
      tone: "green" as const,
      sub: noSalaries
        ? "Todavía no hay sueldos cargados"
        : stats.withSalary < stats.inPayroll
          ? `Con sueldo cargado: ${formatNumber(stats.withSalary)} de ${formatNumber(stats.inPayroll)}`
          : "Suma de los sueldos cargados",
    },
    { title: "Ingresaron este mes", value: formatNumber(stats.newThisMonth), icon: UserPlus, tone: "purple" as const, sub: "Según la fecha de ingreso" },
    { title: "Áreas con personal", value: formatNumber(stats.areaCount), icon: BarChart2, tone: "orange" as const, sub: `De ${plural(stats.areasTotal, "área")}` },
  ];
  const areasWithSalary = sanitizedAreas.filter((a) => (stats.budgetByArea[a.id] || 0) > 0);

  const sanitizedRecords = records.map(r => ({
    ...r,
    salary: r.salary ? Number(r.salary) : 0,
    startDate: r.startDate ? r.startDate.toISOString() : null,
    statusUntil: r.statusUntil ? r.statusUntil.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    area: r.area ? {
      id: r.area.id,
      name: r.area.name,
      color: r.area.color
    } : null
  }));

  const exportColumns = [
    { header: "Legajo", accessorKey: "fileNumber" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Apellido", accessorKey: "lastName" },
    { header: "Nombre", accessorKey: "firstName" },
    { header: "Área", accessorKey: "areaName" },
    { header: "Cargo / Función", accessorKey: "position" },
    { header: "Contrato", accessorKey: "contractType" },
    { header: "Estado", accessorKey: "status" },
    { header: "Sueldo ($)", accessorKey: "salary" }
  ];

  const exportData = sanitizedRecords.map(r => ({
    fileNumber: r.fileNumber || "Sin legajo",
    dni: r.dni,
    lastName: r.lastName,
    firstName: r.firstName,
    areaName: r.area?.name || "Sin área",
    position: r.position || "Sin cargo",
    contractType: contractTypeLabel(r.contractType),
    status: hrStatusLabel(r.status),
    salary: r.salary ? formatPesos(r.salary) : "Sin cargar"
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recursos Humanos"
        description="El personal de cada área, su situación y lo que cuesta por mes."
        icon={UserCog}
        actions={
          <>
           <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename="nomina_personal_municipal"
              title="Nómina del personal"
              subtitle="Recursos Humanos"
              label="Exportar nómina"
              orientation="landscape"
           />
           <Sheet>
              <SheetTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Nuevo agente
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader className="mb-6">
                  <SheetTitle>Nuevo agente</SheetTitle>
                  <SheetDescription>Completá los datos para crear el legajo.</SheetDescription>
                </SheetHeader>
                <CreateHRForm areas={sanitizedAreas} />
              </SheetContent>
           </Sheet>
          </>
        }
      />

      <StatRow>
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.title}
            label={kpi.title}
            value={kpi.value}
            hint={kpi.sub}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </StatRow>

      <Card className="rounded-2xl border border-border/60 shadow-sm bg-card text-card-foreground">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-muted-foreground" /> Sueldos por área
          </h3>
          {areasWithSalary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay sueldos cargados. Cuando cargues el sueldo de cada agente (desde “Editar legajo”, en el menú de su fila), acá vas a ver cuánto suma cada área.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {areasWithSalary.map((area) => (
                <div key={area.id} className="bg-muted/30 p-4 rounded-2xl border border-border/40">
                  <p className="text-xs font-semibold text-muted-foreground truncate mb-1" title={area.name}>{getAreaShortName(area.name)}</p>
                  <p className="text-sm font-bold text-card-foreground tabular-nums">{formatPesos(stats.budgetByArea[area.id] || 0)}</p>
                  <p className="text-xs text-muted-foreground">{plural(stats.staffByArea[area.id] || 0, "agente")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm">
        <HRFilters areas={sanitizedAreas} />

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Agente</TableHead>
              <TableHead>Área y cargo</TableHead>
              <TableHead>Ingreso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sanitizedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyMessage
                    kind={q || (area && area !== "all") || (status && status !== "all") ? "search" : "empty"}
                    title={q || (area && area !== "all") || (status && status !== "all") ? "Nadie del personal coincide con la búsqueda" : "Todavía no hay personal cargado"}
                    action={
                      q || (area && area !== "all") || (status && status !== "all") ? (
                        <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                          <Link href="/admin/hr">Quitar filtros</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              sanitizedRecords.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={r.imageUrl || ""} alt={r.firstName} className="object-cover" />
                        <AvatarFallback className={`font-bold text-sm ${initialsColor(r.dni || r.id)}`}>
                          {initialsOf(r.firstName, r.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">{r.firstName} {r.lastName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                           {r.fileNumber ? `Legajo ${r.fileNumber}` : "Sin legajo"} <span className="text-border">•</span> DNI {r.dni}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm text-foreground">{r.area ? getAreaShortName(r.area.name) : "Sin área"}</p>
                      <p className="text-xs text-muted-foreground">{r.position || "Sin cargo"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                     <p className="text-xs text-muted-foreground">
                        {r.startDate ? formatFechaCalendario(r.startDate) : "Sin fecha"}
                     </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge tone={toneOf(HR_STATUS_TONE, r.status || "ACTIVO")}>{hrStatusLabel(r.status)}</StatusBadge>
                      {r.statusUntil && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                           <Calendar className="h-2.5 w-2.5" /> Hasta {formatFechaCalendario(r.statusUntil)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    <AgentActionsMenu agent={r} areas={sanitizedAreas} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center border-t border-border/40 bg-muted/20 px-4 py-3">
           <p className="text-xs text-muted-foreground">{sanitizedRecords.length === 1 ? "Se muestra 1 agente" : `Se muestran ${formatNumber(sanitizedRecords.length)} agentes`}</p>
        </div>
      </div>
    </div>
  );
}
