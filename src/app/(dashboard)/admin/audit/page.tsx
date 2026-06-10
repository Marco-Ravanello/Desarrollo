export const dynamic = "force-dynamic";

import { getAuditLogs } from "@/services/system";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Activity, User, Calendar, Database } from "lucide-react";

export default async function AuditPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    redirect("/dashboard");
  }

  const logs = await getAuditLogs();

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE': return <Badge className="bg-emerald-100 text-emerald-700">CREACIÓN</Badge>;
      case 'UPDATE': return <Badge className="bg-blue-100 text-blue-700">ACTUALIZACIÓN</Badge>;
      case 'DELETE': return <Badge variant="destructive">ELIMINACIÓN</Badge>;
      case 'LOGIN': return <Badge variant="outline">INGRESO</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Registro de Auditoría</h2>
        <p className="text-slate-500">Seguimiento de acciones realizadas por los usuarios en el sistema.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-400" />
            Acciones Recientes
          </CardTitle>
          <CardDescription>Mostrando los últimos 100 eventos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                    No se han registrado acciones de auditoría aún.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(log.createdAt).toLocaleString('es-AR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" /> {log.user.name}
                        </span>
                        <span className="text-[10px] text-slate-500">{log.user.area?.name || 'Sin área'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm font-mono">
                        <Database className="h-3 w-3 text-slate-400" /> {log.entity}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="text-xs text-slate-600 truncate" title={log.details || ''}>
                        {log.details || <span className="italic text-slate-400">Sin detalles</span>}
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
