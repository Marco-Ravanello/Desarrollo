export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getReportData, parseReportPeriod } from "@/services/reports";
import { getCaseLabelCounts } from "@/services/case-labels";
import { getProgramMovementCounts } from "@/services/program-enrollment";
import { getCaseStatusConfig, getOrderStatusConfig } from "@/lib/status-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { ReportTrendChart } from "./report-trend-chart";
import { ExecutiveReportButton } from "./executive-report-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, type StatTone } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { BarChart3, Briefcase, FolderOpen, HandHeart, Wallet } from "lucide-react";

const money = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "Sin presupuesto");
const shortDate = (s: string) => s.split("-").reverse().join("/");

function presets() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const [y, m] = today.split("-").map(Number);
  const back = (months: number) => {
    const d = new Date(Date.UTC(y, m - 1 - months, 1));
    return d.toISOString().slice(0, 10);
  };
  return [
    { label: "Este mes", desde: `${today.slice(0, 7)}-01`, hasta: today },
    { label: "Últimos 3 meses", desde: back(2), hasta: today },
    { label: "Este año", desde: `${y}-01-01`, hasta: today },
    { label: "Año anterior", desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` },
  ];
}

export const metadata = { title: "Reportes" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role as any, PERMISSIONS.VIEW_REPORTS)) {
    redirect("/dashboard");
  }

  const { desde, hasta } = await searchParams;
  const period = parseReportPeriod(desde, hasta);
  const [data, labelCounts, programMoves] = await Promise.all([
    getReportData(period),
    getCaseLabelCounts({
      canViewSensitive: hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES),
      createdFrom: period.from,
      createdTo: period.to,
    }),
    getProgramMovementCounts(period.from, period.to),
  ]);
  const periodLabel = `${shortDate(period.fromStr)} al ${shortDate(period.toStr)}`;
  const fileSuffix = `${period.fromStr}_${period.toStr}`;

  const kpis: { label: string; value: string; hint?: string; icon: typeof FolderOpen; tone: StatTone }[] = [
    { label: "Expedientes nuevos", value: data.totals.cases.toLocaleString("es-AR"), hint: `${data.totals.urgent} urgentes`, icon: FolderOpen, tone: "blue" },
    { label: "Intervenciones", value: data.totals.interventions.toLocaleString("es-AR"), icon: HandHeart, tone: "orange" },
    { label: "Órdenes de compra", value: data.totals.orders.toLocaleString("es-AR"), icon: Briefcase, tone: "purple" },
    { label: "Ejecutado", value: money(data.totals.executed), hint: "Órdenes aprobadas o cumplidas", icon: Wallet, tone: "green" },
  ];

  const areaRows = data.areas.map((a) => ({
    area: a.area,
    cases: a.cases,
    closed: a.closed,
    urgent: a.urgent,
    interventions: a.interventions,
    orders: a.orders,
    executed: money(a.executed),
    budgetPct: pct(a.executed, a.annualBudget),
  }));
  const caseRows = data.caseStatus.map((c) => ({ estado: getCaseStatusConfig(c.status).label, cantidad: c.count }));
  const orderRows = data.orderStatus.map((o) => ({ estado: getOrderStatusConfig(o.status).label, cantidad: o.count, monto: money(o.amount) }));
  const labelRows = [...labelCounts]
    .sort((a, b) => b.total - a.total)
    .map((l) => ({ key: l.key, etiqueta: l.label, cantidad: l.total, sinCerrar: l.open }));
  const anyLabel = labelRows.some((l) => l.cantidad > 0);
  const providerRows = data.topProviders.map((p) => ({ name: p.name, cuit: p.cuit || "Sin CUIT", orders: p.orders, executed: money(p.executed) }));

  const empty = <EmptyMessage kind="search" compact title="No hay registros en este período" description="Probá con un período más largo." />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Reportes"
        description={<>Indicadores de gestión del {periodLabel}.</>}
        icon={BarChart3}
        actions={<ExecutiveReportButton />}
      />

      <Card className="shadow-none">
        <CardContent className="pt-6 flex flex-col lg:flex-row lg:items-end gap-4">
          <form className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Desde
              <Input type="date" name="desde" defaultValue={period.fromStr} className="w-full sm:w-44" />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Hasta
              <Input type="date" name="hasta" defaultValue={period.toStr} className="w-full sm:w-44" />
            </label>
            <Button type="submit">Aplicar</Button>
          </form>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {presets().map((p) => (
              <Link key={p.label} href={`/admin/reports?desde=${p.desde}&hasta=${p.hasta}`}>
                <Button variant="outline" size="sm">{p.label}</Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Evolución mensual</CardTitle>
          <CardDescription>Expedientes abiertos e intervenciones registradas por mes.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.totals.cases + data.totals.interventions === 0 ? empty : <ReportTrendChart data={data.trend} />}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Resumen por área</CardTitle>
            <CardDescription>El porcentaje compara lo ejecutado en el período con el presupuesto anual del área.</CardDescription>
          </div>
          <UniversalExportMenu
            label="Exportar"
            data={areaRows}
            filename={`reporte_areas_${fileSuffix}`}
            title="Resumen por área"
            subtitle={`Período: ${periodLabel}`}
            orientation="landscape"
            columns={[
              { header: "Área", accessorKey: "area" },
              { header: "Expedientes nuevos", accessorKey: "cases" },
              { header: "Cerrados", accessorKey: "closed" },
              { header: "Urgentes", accessorKey: "urgent" },
              { header: "Intervenciones", accessorKey: "interventions" },
              { header: "Órdenes de compra", accessorKey: "orders" },
              { header: "Ejecutado", accessorKey: "executed" },
              { header: "% presupuesto anual", accessorKey: "budgetPct" },
            ]}
          />
        </CardHeader>
        <CardContent>
          {areaRows.length === 0 ? empty : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Área</TableHead>
                    <TableHead className="text-right">Expedientes</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Cerrados</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Urgentes</TableHead>
                    <TableHead className="text-right">Intervenciones</TableHead>
                    <TableHead className="text-right hidden md:table-cell">OC</TableHead>
                    <TableHead className="text-right">Ejecutado</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">% presup.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaRows.map((a) => (
                    <TableRow key={a.area}>
                      <TableCell className="font-medium text-sm">{a.area}</TableCell>
                      <TableCell className="text-right">{a.cases}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{a.closed}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{a.urgent}</TableCell>
                      <TableCell className="text-right">{a.interventions}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{a.orders}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{a.executed}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">{a.budgetPct}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.totals.unassignedExecuted > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Además hay {money(data.totals.unassignedExecuted)} ejecutados en órdenes sin área asignada.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Expedientes por estado</CardTitle>
              <CardDescription>Estado actual de los expedientes abiertos en el período.</CardDescription>
            </div>
            <UniversalExportMenu
              label="Exportar"
              data={caseRows}
              filename={`reporte_expedientes_${fileSuffix}`}
              title="Expedientes por estado"
              subtitle={`Período: ${periodLabel}`}
              columns={[{ header: "Estado", accessorKey: "estado" }, { header: "Cantidad", accessorKey: "cantidad" }]}
            />
          </CardHeader>
          <CardContent>
            {caseRows.length === 0 ? empty : (
              <Table>
                <TableBody>
                  {caseRows.map((c) => (
                    <TableRow key={c.estado}>
                      <TableCell>{c.estado}</TableCell>
                      <TableCell className="text-right font-medium">{c.cantidad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Órdenes de compra por estado</CardTitle>
              <CardDescription>Órdenes cargadas en el período.</CardDescription>
            </div>
            <UniversalExportMenu
              label="Exportar"
              data={orderRows}
              filename={`reporte_compras_${fileSuffix}`}
              title="Órdenes de compra por estado"
              subtitle={`Período: ${periodLabel}`}
              columns={[
                { header: "Estado", accessorKey: "estado" },
                { header: "Cantidad", accessorKey: "cantidad" },
                { header: "Monto", accessorKey: "monto" },
              ]}
            />
          </CardHeader>
          <CardContent>
            {orderRows.length === 0 ? empty : (
              <Table>
                <TableBody>
                  {orderRows.map((o) => (
                    <TableRow key={o.estado}>
                      <TableCell>{o.estado}</TableCell>
                      <TableCell className="text-right">{o.cantidad}</TableCell>
                      <TableCell className="text-right font-medium">{o.monto}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Expedientes por etiqueta</CardTitle>
            <CardDescription>Expedientes abiertos en el período con cada etiqueta. Uno puede tener varias.</CardDescription>
          </div>
          {anyLabel && (
            <UniversalExportMenu
              label="Exportar"
              data={labelRows}
              filename={`reporte_etiquetas_${fileSuffix}`}
              title="Expedientes por etiqueta"
              subtitle={`Período: ${periodLabel}`}
              columns={[
                { header: "Etiqueta", accessorKey: "etiqueta" },
                { header: "Expedientes", accessorKey: "cantidad" },
                { header: "Sin cerrar", accessorKey: "sinCerrar" },
              ]}
            />
          )}
        </CardHeader>
        <CardContent>
          {!anyLabel ? (
            <EmptyMessage
              compact
              title="Ningún expediente del período tiene etiquetas"
              description="Las etiquetas se ponen al abrir el expediente o desde su página, con el botón Agregar etiquetas."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead className="text-right">Expedientes</TableHead>
                  <TableHead className="text-right">Sin cerrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labelRows.map((l) => (
                  <TableRow key={l.key} className={l.cantidad === 0 ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      {l.cantidad > 0 ? (
                        <Link href={`/cases?label=${l.key}`} className="font-medium text-primary hover:underline">{l.etiqueta}</Link>
                      ) : (
                        l.etiqueta
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{l.cantidad.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.sinCerrar.toLocaleString("es-AR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Altas y bajas en los programas</CardTitle>
            <CardDescription>Personas que entraron a cada programa o salieron de él en el período, desde su ficha o por planilla.</CardDescription>
          </div>
          {programMoves.length > 0 && (
            <UniversalExportMenu
              label="Exportar"
              data={programMoves.map((p) => ({ programa: p.label, altas: p.altas, bajas: p.bajas }))}
              filename={`reporte_altas_bajas_${fileSuffix}`}
              title="Altas y bajas en los programas"
              subtitle={`Período: ${periodLabel}`}
              columns={[
                { header: "Programa", accessorKey: "programa" },
                { header: "Altas", accessorKey: "altas" },
                { header: "Bajas", accessorKey: "bajas" },
              ]}
            />
          )}
        </CardHeader>
        <CardContent>
          {programMoves.length === 0 ? (
            <EmptyMessage
              compact
              title="No hubo altas ni bajas en este período"
              description="Se registran cuando se da de alta o de baja a una persona desde su ficha, o cuando se importa una planilla."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programa</TableHead>
                  <TableHead className="text-right">Altas</TableHead>
                  <TableHead className="text-right">Bajas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programMoves.map((p) => (
                  <TableRow key={p.column}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.altas.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.bajas.toLocaleString("es-AR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Principales proveedores</CardTitle>
            <CardDescription>Los 10 proveedores con mayor monto ejecutado en el período.</CardDescription>
          </div>
          <UniversalExportMenu
            label="Exportar"
            data={providerRows}
            filename={`reporte_proveedores_${fileSuffix}`}
            title="Principales proveedores"
            subtitle={`Período: ${periodLabel}`}
            columns={[
              { header: "Proveedor", accessorKey: "name" },
              { header: "CUIT", accessorKey: "cuit" },
              { header: "Órdenes", accessorKey: "orders" },
              { header: "Ejecutado", accessorKey: "executed" },
            ]}
          />
        </CardHeader>
        <CardContent>
          {providerRows.length === 0 ? empty : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="hidden sm:table-cell">CUIT</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                    <TableHead className="text-right">Ejecutado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerRows.map((p) => (
                    <TableRow key={`${p.name}-${p.cuit}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs">{p.cuit}</TableCell>
                      <TableCell className="text-right">{p.orders}</TableCell>
                      <TableCell className="text-right">{p.executed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
