"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { TableCards } from "@/components/ui/table";
import {
  Users, UserCheck, UserX, Shield, Search, Plus, Edit2,
  Building2, UserCog
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { CreateUserForm } from "./create-user-form";
import { EditUserDialog } from "./edit-user-dialog";
import { toggleUserStatusAction } from "../actions/user-actions";
import { toast } from "sonner";
import { Role } from "@prisma/client";

interface AreaItem {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  areaId: string | null;
  isActive?: boolean;
  area?: AreaItem | null;
}

interface UsersManagementViewProps {
  users: (UserItem & { isActive: boolean })[];
  areas: AreaItem[];
  currentUserId: string;
  autoOpenNew?: boolean;
}

export function UsersManagementView({
  users,
  areas,
  currentUserId,
  autoOpenNew = false
}: UsersManagementViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(autoOpenNew));
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("TODOS");

  const [editingUser, setEditingUser] = useState<(UserItem & { isActive: boolean }) | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = (userId: string, currentActive: boolean) => {
    if (userId === currentUserId) {
      toast.error("No puede desactivar su propio usuario administrador en sesión");
      return;
    }

    startTransition(async () => {
      const res = await toggleUserStatusAction(userId);
      if (res.success) {
        toast.success(
          res.isActive ? "Cuenta de agente activada" : "Cuenta de agente suspendida"
        );
      } else {
        toast.error(res.error || "Error al cambiar estado del agente");
      }
    });
  };

  const usersWithStatus = users.map((u) => ({
    ...u,
    isActive: u.isActive !== undefined ? Boolean(u.isActive) : true
  }));

  const filteredUsers = usersWithStatus.filter((u) => {
    if (statusFilter === "ACTIVOS" && !u.isActive) return false;
    if (statusFilter === "INACTIVOS" && u.isActive) return false;

    if (roleFilter !== "TODOS" && u.role !== roleFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name?.toLowerCase().includes(q) || false;
      const matchEmail = u.email?.toLowerCase().includes(q) || false;
      const matchArea = u.area?.name.toLowerCase().includes(q) || false;
      if (!matchName && !matchEmail && !matchArea) return false;
    }

    return true;
  });

  const totalUsers = users.length;
  const activeCount = usersWithStatus.filter((u) => u.isActive).length;
  const inactiveCount = totalUsers - activeCount;
  const execCount = users.filter((u) => u.role === "SUPERADMIN" || u.role === "DIRECCION_GENERAL").length;

  const exportColumns = [
    { header: "Nombre Completo", accessorKey: "name" },
    { header: "Correo Electrónico", accessorKey: "email" },
    { header: "Rol", accessorKey: "role" },
    { header: "Área Asignada", accessorKey: "areaName" },
    { header: "Estado", accessorKey: "status" }
  ];

  const exportData = filteredUsers.map((u) => ({
    name: u.name || "Sin Nombre",
    email: u.email || "N/R",
    role: u.role,
    areaName: u.area?.name || "Administración General",
    status: u.isActive ? "ACTIVO" : "INACTIVO"
  }));

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case "SUPERADMIN":
        return <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold text-[10px]">SUPERADMIN</Badge>;
      case "DIRECCION_GENERAL":
        return <Badge className="bg-purple-500/15 text-purple-500 border border-purple-500/30 font-bold text-[10px]">DIRECCIÓN GENERAL</Badge>;
      case "ADMIN_GENERAL":
        return <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 font-bold text-[10px]">ADMIN GENERAL</Badge>;
      case "DIRECTOR_AREA":
        return <Badge className="bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 font-bold text-[10px]">DIRECTOR ÁREA</Badge>;
      case "VIOLENCIA_GENERO":
        return <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold text-[10px]">VIOLENCIA GÉNERO</Badge>;
      case "RELEVADOR_EMERGENCIA":
        return <Badge className="bg-sky-500/15 text-sky-600 border border-sky-500/30 font-bold text-[10px]">RELEVAMIENTO EMERGENCIA</Badge>;
      case "AUDITOR":
        return <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-[10px]">AUDITOR</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px]">OPERATIVO</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader
        title="Gestión de Usuarios y Personal"
        description="Administración de agentes, reasignación de áreas municipales, roles y conmutador de estados."
        icon={UserCog}
        badge="Personal Tres de Febrero"
        actions={
          <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <SheetTrigger asChild>
              <Button className="rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2 font-heading">
                <Plus className="h-4 w-4" />
                <span>Nuevo Usuario</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-md w-full bg-card border-l border-border/60 p-6 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-xl font-bold font-heading">Alta de Funcionario</SheetTitle>
                <SheetDescription className="text-xs">
                  Creación de credenciales para agentes de Tres de Febrero.
                </SheetDescription>
              </SheetHeader>
              <CreateUserForm areas={areas} onSuccess={() => setIsCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Agentes"
          value={totalUsers}
          hint="Registrados en sistema"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Cuentas Activas"
          value={activeCount}
          hint="Habilitados para login"
          icon={UserCheck}
          tone="green"
        />
        <StatCard
          label="Cuentas Suspendidas"
          value={inactiveCount}
          hint="Acceso bloqueado"
          icon={UserX}
          tone="red"
        />
        <StatCard
          label="Directivos y Admin"
          value={execCount}
          hint="Roles ejecutivos"
          icon={Shield}
          tone="purple"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/40 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("TODOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "TODOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({totalUsers})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "ACTIVOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "INACTIVOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactivos ({inactiveCount})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o área..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60 text-foreground"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            >
              <option value="TODOS">Todos los roles</option>
              {Object.values(Role).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename="personal_municipal_tres_de_febrero"
              title="Padrón Unificado de Personal y Funcionario Municipal"
              subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
              label="Exportar"
            />
          </div>
        </div>

        <TableCards>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
              <tr>
                <th className="px-5 py-3.5">Funcionario / Agente</th>
                <th className="px-4 py-3.5">Correo Electrónico</th>
                <th className="px-4 py-3.5">Rol e Atribuciones</th>
                <th className="px-4 py-3.5">Área Municipal Asignada</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSelf = currentUserId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name ? u.name[0].toUpperCase() : "A"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground leading-tight">
                              {u.name || "Agente Sin Nombre"}
                            </p>
                            {isSelf && (
                              <Badge variant="outline" className="text-[9px] font-bold border-primary/30 text-primary mt-0.5">
                                Su Sesión Actual
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3.5">
                        {renderRoleBadge(u.role)}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{u.area?.name || "Administración General"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isSelf || isPending}
                          onClick={() => handleToggleStatus(u.id, u.isActive)}
                          title={isSelf ? "No puede desactivarse a sí mismo" : "Haga clic para cambiar estado"}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                            u.isActive
                              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30"
                              : "bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30"
                          } ${isSelf ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {u.isActive ? "ACTIVO" : "SUSPENDIDO"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(u);
                            setIsEditDialogOpen(true);
                          }}
                          className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl gap-1"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyMessage title="No se encontraron agentes municipales que coincidan con la búsqueda." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCards>
      </Card>

      <EditUserDialog
        user={editingUser}
        areas={areas}
        currentUserId={currentUserId}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}
