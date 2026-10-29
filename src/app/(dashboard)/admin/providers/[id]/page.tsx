export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProviderDetail } from "@/services/providers";
import { getOrderStatusConfig } from "@/lib/status-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, FileText, PenLine, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { ProviderFormDialog } from "../provider-form-dialog";
import { DeleteProviderButton } from "../delete-provider-button";
import { formatFecha } from "@/lib/fechas";
import { providerTitle } from "@/lib/page-titles";
import { formatPesos, plural } from "@/lib/formato";
import { getAreaShortName } from "@/lib/area-theme";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";

export const generateMetadata = providerTitle;

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, detail] = await Promise.all([auth(), getProviderDetail(id)]);
  if (!detail) notFound();

  const { provider, orders } = detail;
  const canEdit = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"].includes(session?.user?.role as string);
  const executed = orders
    .filter((o) => o.status === "APROBADA" || o.status === "CUMPLIDA")
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pending = orders.filter((o) => o.status === "PENDIENTE_APROBACION");

  const info: [string, string | null][] = [
    ["CUIT", provider.cuit],
    ["Domicilio", provider.address],
    ["Teléfono", provider.phone],
    ["Correo", provider.email],
    ["Banco", provider.bank],
    ["CBU", provider.cbu],
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={provider.name}
        description={provider.cuit ? `CUIT ${provider.cuit}` : "Proveedor sin CUIT"}
        icon={Building2}
        actions={
          <>
            {canEdit && (
              <>
                {orders.length === 0 && <DeleteProviderButton id={provider.id} name={provider.name} />}
                <ProviderFormDialog
                  initial={{
                    id: provider.id,
                    name: provider.name,
                    cuit: provider.cuit,
                    address: provider.address || "",
                    phone: provider.phone || "",
                    email: provider.email || "",
                    bank: provider.bank || "",
                    cbu: provider.cbu || "",
                  }}
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                  }
                />
              </>
            )}
          </>
        }
      />

      <StatRow className="lg:grid-cols-3">
        <StatCard label="Órdenes de compra" value={orders.length} hint="Todas, en cualquier estado" icon={FileText} tone="blue" />
        <StatCard label="Ejecutado" value={formatPesos(executed)} hint="Órdenes aprobadas o cumplidas" icon={CheckCircle2} tone="green" />
        <StatCard
          label="Pendientes de aprobación"
          value={pending.length}
          hint={pending.length > 0 ? formatPesos(pending.reduce((t, o) => t + Number(o.amount || 0), 0)) : "Ninguna esperando"}
          icon={PenLine}
          tone="orange"
        />
      </StatRow>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos del proveedor</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {info.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium text-foreground break-all">{value || "Sin cargar"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Órdenes de compra</CardTitle>
          <CardDescription>
            {plural(orders.length, "orden", "órdenes")}, también las cargadas solo con el CUIT de este proveedor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyMessage compact title="Este proveedor todavía no tiene órdenes de compra" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="hidden md:table-cell">Área</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const status = getOrderStatusConfig(o.status);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/purchase-orders/${o.id}`} className="text-foreground hover:text-primary hover:underline">
                            {o.number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatFecha(o.createdAt)}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {o.area?.name ? getAreaShortName(o.area.name) : "Sin área"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.badgeClass}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatPesos(Number(o.amount || 0))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
