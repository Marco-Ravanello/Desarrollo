export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { getProvidersOverview, formatCuit } from "@/services/providers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Search, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { ProviderFormDialog } from "./provider-form-dialog";

const money = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [session, { providers, total, unregistered }] = await Promise.all([auth(), getProvidersOverview(q)]);
  const canEdit = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"].includes(session?.user?.role as string);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Proveedores"
        description="Padrón de proveedores y su historial de órdenes de compra."
        icon={Building2}
        actions={
          canEdit ? (
            <ProviderFormDialog trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo proveedor</Button>} />
          ) : undefined
        }
      />

      {canEdit && unregistered.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {unregistered.length} proveedores aparecen en órdenes de compra pero no están dados de alta
            </CardTitle>
            <CardDescription>Al registrarlos se completan con los datos de la orden y se suman a su historial.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unregistered.slice(0, 10).map((u) => (
              <ProviderFormDialog
                key={u.cuit}
                initial={{ name: u.name, cuit: formatCuit(u.cuit) }}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> {u.name || formatCuit(u.cuit)} ({u.orderCount} OC)
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Registrados ({total})</CardTitle>
            <CardDescription>Ejecutado = órdenes aprobadas o cumplidas.</CardDescription>
          </div>
          <form className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={q || ""} placeholder="Buscar por nombre o CUIT" className="pl-9" />
          </form>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <EmptyMessage
              icon={Building2}
              kind={q ? "search" : "empty"}
              title={q ? "Ningún proveedor coincide con la búsqueda" : "Todavía no hay proveedores registrados"}
              description={q ? "Probá con otra parte del nombre o con el CUIT sin guiones." : "Los proveedores que cargues aparecen acá."}
              action={
                q ? (
                  <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                    <Link href="/admin/providers">Borrar búsqueda</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón social</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                    <TableHead className="text-right">Ejecutado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/providers/${p.id}`} className="hover:underline text-primary">{p.name}</Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.cuit}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {[p.phone, p.email].filter(Boolean).join(" · ") || "Sin datos"}
                      </TableCell>
                      <TableCell className="text-right">{p.orderCount}</TableCell>
                      <TableCell className="text-right">{money(p.executed)}</TableCell>
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
