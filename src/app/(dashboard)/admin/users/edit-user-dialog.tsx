"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import {
  User, Mail, Shield, Building2, Lock, Save, RefreshCw, AlertTriangle
} from "lucide-react";
import { updateUserAction } from "../actions/user-actions";

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
}

interface EditUserDialogProps {
  user: UserItem | null;
  areas: AreaItem[];
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_DESCRIPTIONS: Record<Role, { title: string; desc: string }> = {
  SUPERADMIN: {
    title: "Superadministrador General",
    desc: "Acceso total a auditorías, usuarios, áreas y configuraciones del servidor."
  },
  DIRECCION_GENERAL: {
    title: "Dirección General Executive",
    desc: "Vista estratégica de la Sala de Situación, reportes ejecutivos y casos de violencia."
  },
  ADMIN_GENERAL: {
    title: "Administración General",
    desc: "Gestión global de compras, insumos, flota vehicular y recursos de áreas."
  },
  DIRECTOR_AREA: {
    title: "Director de Área / Secretaría",
    desc: "Coordinación directa de agentes, aprobación de trámites y expedientes locales."
  },
  OPERATIVO: {
    title: "Agente Operativo / Trabajo Social",
    desc: "Carga de intervenciones territoriales, expedientes sociales y asistencia directa."
  },
  AUDITOR: {
    title: "Auditor / Control de Gestión",
    desc: "Acceso de lectura y fiscalización de trazabilidad financiera e intervenciones."
  },
  VIOLENCIA_GENERO: {
    title: "Especialista Violencia de Género",
    desc: "Acceso exclusivo a legajos y casos confidenciales con protección de datos."
  }
};

export function EditUserDialog({
  user,
  areas,
  currentUserId,
  open,
  onOpenChange
}: EditUserDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState<Role>(user?.role || "OPERATIVO");
  const [areaId, setAreaId] = useState<string>(user?.areaId || "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState<boolean>(user?.isActive ?? true);

  const isSelf = currentUserId === user?.id;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim() || !email.trim()) {
      toast.error("El nombre y el correo electrónico son obligatorios");
      return;
    }

    startTransition(async () => {
      const res = await updateUserAction({
        id: user.id,
        name: name.trim(),
        email: email.trim(),
        role,
        areaId: areaId || null,
        password: password.trim() || undefined,
        isActive
      });

      if (res.success) {
        toast.success(`Perfil de agente ${user.email} actualizado correctamente`);
        onOpenChange(false);
      } else {
        toast.error(res.error || "Error al actualizar perfil del agente");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl bg-card border-border/60 text-card-foreground p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Editar Perfil de Agente Municipal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Modifique los permisos institucionales, reasigne áreas o restablezca contraseñas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Nombre y Apellido</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lic. Bautista Pino"
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Correo Electrónico Oficial</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@tresdefebrero.gov.ar"
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Rol e Atribuciones</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.keys(ROLE_DESCRIPTIONS).map((rKey) => (
                  <option key={rKey} value={rKey}>
                    {rKey}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Área Municipal Asignada</Label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sin Área Específica (Global)</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1 text-xs">
            <span className="font-bold text-primary">{ROLE_DESCRIPTIONS[role]?.title}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ROLE_DESCRIPTIONS[role]?.desc}
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Restablecer Contraseña Temporal</span>
              <span className="text-[10px] text-muted-foreground font-normal">(Dejar en blanco para conservar)</span>
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva clave opcional (mínimo 6 caracteres)..."
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Estado de la Cuenta Institucional</p>
              <p className="text-[11px] text-muted-foreground">
                {isActive ? "Cuenta habilitada para inicio de sesión" : "Acceso bloqueado en auth"}
              </p>
            </div>

            <button
              type="button"
              disabled={isSelf}
              onClick={() => setIsActive(!isActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-500 border border-rose-500/30"
              }`}
            >
              {isActive ? "Cuenta Activa" : "Suspendida"}
            </button>
          </div>

          {isSelf && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Está editando su propia sesión activa. El cambio de estado queda inhabilitado.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="rounded-xl h-10 text-xs font-bold border-border/60"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-xl h-10 px-5 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Guardar Perfil</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
