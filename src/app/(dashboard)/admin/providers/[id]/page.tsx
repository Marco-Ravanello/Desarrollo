export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProviderDetail } from "@/services/providers";
import { getOrderStatusConfig } from "@/lib/status-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { ProviderFormDialog } from "../provider-form-dialog";
import { DeleteProviderButton } from "../delete-provider-button";

const money = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export const metadata = { title: "Proveedor" };

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, detail] = await Promise.all([auth(), getProviderDetail(id)]);
  if (!detail) notFound();

  const { provider, orders } = detail;
  const canEdit = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"].includes(session?.user?.role as string);
  const executed = orders
    .filter((o) => o.status === "APROBADA" || o.status === "CUMPLIDA")
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const info: [string, string | null][] = [
    ["CUIT", provider.cuit],
    ["Domicilio", provider.address],
    ["Teléfono", provider.phone],
    ["Email", provider.email],
    ["Banco", provider.bank],
    ["CBU", provider.cbu],
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={provider.name}
        description={<>{orders.length} órdenes de compra · {money(executed)} ejecutado</>}
        icon={Building2}
        actions={
          <>
            <Link href="/admin/providers">
              <Button variant="ghost" size="icon" aria-label="Volver a proveedores"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            {canEdit && (
              <>
                {orders.length === 0 && <DeleteProviderButton id={provider.id} name={provider.name} />}
                <ProviderFormDialog
                  initial={{
                    id: provider.id, name: provider.name, cuit: provider.cuit, address: provider.address || "",
                    phone: provider.phone || "", email: provider.email || "", bank: provider.bank || "", cbu: provider.cbu || "",
                  }}
                  trigger={<Button variant="outline" className="gap-2"><Pencil className="h-4 w-4" /> Editar</Button>}
                />
              </>
            )}
          </>
        }
      />

      <Card className="shadow-none">
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          {info.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium text-foreground break-all">{value || "Sin dato"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Historial de órdenes de compra</CardTitle>
          <CardDescription>Incluye las órdenes cargadas con el CUIT de este proveedor.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyMessage compact title="Este proveedor todavía no tiene órdenes de compra" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OC</TableHead>
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
                          <Link href={`/admin/purchase-orders/${o.id}`} className="hover:underline text-primary">{o.number}</Link>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(o.createdAt).toLocaleDateString("es-AR")}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{o.area?.name || "Sin área"}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${status.badgeClass}`}>{status.label}</span>
                        </TableCell>
                        <TableCell className="text-right">{money(Number(o.amount || 0))}</TableCell>
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
