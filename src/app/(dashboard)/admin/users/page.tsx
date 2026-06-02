export const dynamic = "force-dynamic";
import { getUsers } from "@/services/system";
import { getAreas } from "@/services/cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserCog, Mail, Briefcase } from "lucide-react";
import { CreateUserForm } from "./create-user-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    redirect("/dashboard");
  }

  const [users, areas] = await Promise.all([
    getUsers(),
    getAreas()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
        <p className="text-slate-500">Administre las cuentas y permisos del personal municipal.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreateUserForm areas={areas} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cuentas Registradas</CardTitle>
            <CardDescription>Lista completa de usuarios con acceso al sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol / Área</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {u.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                         <Badge variant="outline" className="w-fit text-[10px] uppercase font-bold">
                           <ShieldCheck className="h-3 w-3 mr-1" /> {u.role}
                         </Badge>
                         {u.area && (
                           <div className="text-xs text-slate-500 flex items-center gap-1">
                             <Briefcase className="h-3 w-3" /> {u.area.name}
                           </div>
                         )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activo</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
