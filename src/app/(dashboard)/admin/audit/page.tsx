export const dynamic = "force-dynamic";

import { getAuditLogs } from "@/services/system";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Activity, User, Calendar, Database } from "lucide-react";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role as any, PERMISSIONS.VIEW_AUDIT_LOGS)) {
    redirect("/dashboard");
  }

  const logs = await getAuditLogs();

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">CREACIÓN</Badge>;
      case 'UPDATE': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">ACTUALIZACIÓN</Badge>;
      case 'DELETE': return <Badge variant="destructive">ELIMINACIÓN</Badge>;
      case 'LOGIN': return <Badge variant="outline">INGRESO</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Registro de Auditoría</h2>
        <p className="text-muted-foreground">Seguimiento de acciones realizadas por los usuarios en el sistema.</p>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="h-5 w-5 text-primary" />
            Acciones Recientes
          </CardTitle>
          <CardDescription className="text-muted-foreground">Mostrando los últimos 100 eventos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="font-bold">Fecha y Hora</TableHead>
                <TableHead className="font-bold">Usuario</TableHead>
                <TableHead className="font-bold">Acción</TableHead>
                <TableHead className="font-bold">Entidad</TableHead>
                <TableHead className="font-bold">Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/30">
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                    No se han registrado acciones de auditoría aún.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(log.createdAt).toLocaleString('es-AR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" /> {log.user.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{log.user.area?.name || 'Sin área'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-foreground">
                        <Database className="h-3 w-3 text-muted-foreground" /> {log.entity}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="text-xs text-muted-foreground truncate" title={log.details || ''}>
                        {log.details || <span className="italic text-muted-foreground/60">Sin detalles</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
