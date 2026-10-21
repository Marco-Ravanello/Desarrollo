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
import { ROLE_INFO, ROLE_ORDER } from "@/lib/roles";

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
  isSuperadmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({
  user,
  areas,
  currentUserId,
  isSuperadmin = false,
  open,
  onOpenChange
}: EditUserDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState<Role>(user?.role || "OPERATIVO");
  const [areaId, setAreaId] = useState<string>(user?.areaId || "");
  const [isActive, setIsActive] = useState<boolean>(user?.isActive ?? true);

  const isSelf = currentUserId === user?.id;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim() || !email.trim()) {
      toast.error("Completá el nombre y el correo.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserAction({
        id: user.id,
        name: name.trim(),
        email: email.trim(),
        role,
        areaId: areaId || null,
        isActive
      });

      if (res.success) {
        toast.success("Cambios guardados.");
        onOpenChange(false);
      } else {
        toast.error(res.error || "No se pudieron guardar los cambios.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl bg-card border-border/60 text-card-foreground p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Editar usuario
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cambiá el nombre, el rol, el área o el estado de la cuenta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Nombre y apellido</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: María Pérez"
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Correo</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@tresdefebrero.gob.ar"
              className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Rol</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {/* Superadmin solo lo da otro Superadmin. */}
                {ROLE_ORDER.filter((r) => r !== "SUPERADMIN" || isSuperadmin || user?.role === "SUPERADMIN").map((r) => (
                  <option key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Área</Label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1 text-xs">
            <span className="font-bold text-primary">{ROLE_INFO[role]?.label}</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ROLE_INFO[role]?.description}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isSuperadmin && !isSelf
                ? "Para darle una clave nueva, usá “Clave temporal” en la lista."
                : isSelf
                  ? "Tu contraseña la cambiás en “Cambiar mi contraseña”, en el menú de tu usuario."
                  : "Las contraseñas de otras personas las restablece el Superadmin."}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Estado de la cuenta</p>
              <p className="text-[11px] text-muted-foreground">
                {isActive ? "Puede ingresar a la app." : "No puede ingresar hasta que se active."}
              </p>
            </div>

            <button
              type="button"
              disabled={isSelf}
              onClick={() => setIsActive(!isActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
              }`}
            >
              {isActive ? "Activa" : "Suspendida"}
            </button>
          </div>

          {isSelf && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Es tu propia cuenta: no la podés suspender.</span>
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
              className="rounded-xl h-10 px-5 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Guardar</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
