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
import { TemporaryPasswordButton } from "./temporary-password-button";
import { toggleUserStatusAction } from "../actions/user-actions";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { ROLE_INFO, ROLE_ORDER, roleLabel } from "@/lib/roles";
import { UNUSED_ACCOUNT_DAYS, type LastLoginInfo } from "@/lib/user-activity";

interface AreaItem {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  role: Role;
  areaId: string | null;
  isActive?: boolean;
  area?: AreaItem | null;
  lastLogin?: LastLoginInfo;
}

interface UsersManagementViewProps {
  users: (UserItem & { isActive: boolean })[];
  areas: AreaItem[];
  currentUserId: string;
  autoOpenNew?: boolean;
  /** Solo el Superadmin crea usuarios y restablece contraseñas de otras personas. */
  isSuperadmin?: boolean;
}

export function UsersManagementView({
  users,
  areas,
  currentUserId,
  autoOpenNew = false,
  isSuperadmin = false
}: UsersManagementViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(autoOpenNew));
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS" | "SIN_USO">("TODOS");

  const [editingUser, setEditingUser] = useState<(UserItem & { isActive: boolean }) | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = (userId: string, currentActive: boolean) => {
    if (userId === currentUserId) {
      toast.error("No podés suspender tu propia cuenta.");
      return;
    }

    startTransition(async () => {
      const res = await toggleUserStatusAction(userId);
      if (res.success) {
        toast.success(
          res.isActive ? "Cuenta activada: ya puede ingresar." : "Cuenta suspendida: no va a poder ingresar."
        );
      } else {
        toast.error(res.error || "No se pudo cambiar el estado de la cuenta.");
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
    if (statusFilter === "SIN_USO" && !(u.isActive && u.lastLogin?.unused)) return false;

    if (roleFilter !== "TODOS" && u.role !== roleFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name?.toLowerCase().includes(q) || false;
      const matchEmail = u.email?.toLowerCase().includes(q) || u.username?.includes(q) || false;
      const matchArea = u.area?.name.toLowerCase().includes(q) || false;
      const matchRole = roleLabel(u.role).toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchArea && !matchRole) return false;
    }

    return true;
  });

  const totalUsers = users.length;
  const activeCount = usersWithStatus.filter((u) => u.isActive).length;
  const inactiveCount = totalUsers - activeCount;
  // Cuentas activas que nadie usa hace tiempo: conviene revisar si hay que suspenderlas.
  const unusedCount = usersWithStatus.filter((u) => u.isActive && u.lastLogin?.unused).length;
  const managementCount = users.filter((u) => u.role === "SUPERADMIN" || u.role === "DIRECCION_GENERAL" || u.role === "ADMIN_GENERAL").length;
  // Solo los roles que hay cargados, en orden de más acceso a menos.
  const rolesInUse = ROLE_ORDER.filter((r) => users.some((u) => u.role === r));

  const exportColumns = [
    { header: "Nombre", accessorKey: "name" },
    { header: "Usuario", accessorKey: "username" },
    { header: "Correo", accessorKey: "email" },
    { header: "Rol", accessorKey: "role" },
    { header: "Área", accessorKey: "areaName" },
    { header: "Estado", accessorKey: "status" },
    { header: "Último ingreso", accessorKey: "lastLogin" }
  ];

  const exportData = filteredUsers.map((u) => ({
    name: u.name || "Sin nombre",
    username: u.username || "",
    email: u.email || "",
    role: roleLabel(u.role),
    areaName: u.area?.name || "Sin área",
    status: u.isActive ? "Activa" : "Suspendida",
    lastLogin: u.lastLogin?.title ?? ""
  }));

  const renderRoleBadge = (role: Role) => (
    <Badge variant="outline" title={ROLE_INFO[role]?.description} className={`whitespace-nowrap font-bold text-xs ${ROLE_INFO[role]?.badgeClass ?? ""}`}>
      {roleLabel(role)}
    </Badge>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader
        title="Usuarios"
        description={
          isSuperadmin
            ? "Quién puede entrar a la app, con qué rol y en qué área."
            : "Quién puede entrar a la app, con qué rol y en qué área. Crear usuarios y restablecer contraseñas lo hace el Superadmin."
        }
        icon={UserCog}
        actions={
          isSuperadmin && (
          <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <SheetTrigger asChild>
              <Button className="rounded-2xl h-11 px-5 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2">
                <Plus className="h-4 w-4" />
                <span>Nuevo usuario</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-md w-full bg-card border-l border-border/60 p-6 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-xl font-bold font-heading">Nuevo usuario</SheetTitle>
                <SheetDescription className="text-xs">
                  La persona entra con su usuario y la clave temporal, y la cambia por una propia.
                </SheetDescription>
              </SheetHeader>
              <CreateUserForm areas={areas} onSuccess={() => setIsCreateOpen(false)} />
            </SheetContent>
          </Sheet>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Usuarios"
          value={totalUsers}
          hint="Cargados en la app"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Activos"
          value={activeCount}
          hint="Pueden ingresar"
          icon={UserCheck}
          tone="green"
        />
        <StatCard
          label="Suspendidos"
          value={inactiveCount}
          hint="No pueden ingresar"
          icon={UserX}
          tone="red"
        />
        <StatCard
          label="Conducción"
          value={managementCount}
          hint="Superadmin, Dirección y Administración General"
          icon={Shield}
          tone="purple"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/40 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("TODOS")}
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
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
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
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
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "INACTIVOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Suspendidos ({inactiveCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("SIN_USO")}
              title={`Cuentas activas que no entran hace ${UNUSED_ACCOUNT_DAYS} días o más`}
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "SIN_USO"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sin entrar hace {UNUSED_ACCOUNT_DAYS} días ({unusedCount})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, usuario, correo, área o rol"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60 text-foreground"
              />
            </div>

            <select
              aria-label="Filtrar por rol"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            >
              <option value="TODOS">Todos los roles</option>
              {rolesInUse.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>

            <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename="usuarios_munigestion"
              title="Usuarios de MuniGestión 3F"
              subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
              label="Exportar"
            />
          </div>
        </div>

        <TableCards>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/40">
              <tr>
                <th className="px-5 py-3.5 min-w-[240px]">Persona</th>
                <th className="px-4 py-3.5">Rol</th>
                <th className="px-4 py-3.5">Área</th>
                <th className="px-4 py-3.5">Estado y último ingreso</th>
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
                            {(u.name || u.email || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground leading-tight">
                              {u.name || "Sin nombre"}
                            </p>
                            {u.username && (
                              <p className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground/80" title="Nombre de usuario para ingresar">{u.username}</p>
                            )}
                            {u.email && (
                              <p className="truncate font-mono text-xs font-normal text-muted-foreground" title={u.email}>{u.email}</p>
                            )}
                            {isSelf && (
                              <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary mt-0.5">
                                Sos vos
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {renderRoleBadge(u.role)}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className={u.area ? "line-clamp-2" : "italic"} title={u.area?.name}>{u.area?.name || "Sin área"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isSelf || isPending}
                          onClick={() => handleToggleStatus(u.id, u.isActive)}
                          title={isSelf ? "No podés suspender tu propia cuenta" : u.isActive ? "Tocá para suspender la cuenta" : "Tocá para volver a activar la cuenta"}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                            u.isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-500/30"
                          } ${isSelf ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {u.isActive ? "Activa" : "Suspendida"}
                        </button>
                        {u.lastLogin && (
                          <p
                            title={u.lastLogin.title}
                            className={`mt-1 whitespace-nowrap text-xs ${u.isActive && u.lastLogin.unused ? "font-bold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                          >
                            {u.lastLogin.days === null ? u.lastLogin.label : `Entró: ${u.lastLogin.label.toLowerCase()}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {isSuperadmin && !isSelf && (
                          <TemporaryPasswordButton userId={u.id} userName={u.name || u.email || "esta persona"} isActive={u.isActive} />
                        )}
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyMessage
                      kind="search"
                      title="Nadie coincide con la búsqueda"
                      description="Probá con otro nombre, usuario, correo o rol."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs"
                          onClick={() => {
                            setSearchQuery("");
                            setRoleFilter("TODOS");
                            setStatusFilter("TODOS");
                          }}
                        >
                          Quitar filtros
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCards>
      </Card>

      <EditUserDialog
        // Se rearma con cada usuario: el formulario toma sus datos al abrirse.
        key={editingUser?.id ?? "ninguno"}
        user={editingUser}
        areas={areas}
        currentUserId={currentUserId}
        isSuperadmin={isSuperadmin}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}
