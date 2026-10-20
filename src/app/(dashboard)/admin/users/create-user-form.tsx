"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createUserAction } from "../actions/user-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Role } from "@prisma/client";
import { UserPlus, Mail, Lock, Shield, Building2, RefreshCw, Copy, Dices } from "lucide-react";
import { generateTemporaryPassword } from "@/lib/temporary-password";

const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "SUPERADMIN - Administración General del Sistema",
  DIRECCION_GENERAL: "DIRECCION_GENERAL - Control Ejecutivo y Sala de Situación",
  ADMIN_GENERAL: "ADMIN_GENERAL - Compras, Insumos y Flota Vehicular",
  DIRECTOR_AREA: "DIRECTOR_AREA - Dirección de Área Municipal",
  OPERATIVO: "OPERATIVO - Trabajo Social y Carga de Expedientes",
  AUDITOR: "AUDITOR - Fiscalización y Trazabilidad de Gestión",
  VIOLENCIA_GENERO: "VIOLENCIA_GENERO - Abordaje Confidencial de Casos",
  RELEVADOR_EMERGENCIA: "RELEVADOR_EMERGENCIA - Solo carga de fichas de emergencia climática"
};

export function CreateUserForm({
  areas,
  onSuccess
}: {
  areas: any[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  // Se genera en el navegador (no en el servidor) para no mostrar la misma clave en dos renders.
  useEffect(() => setPassword(generateTemporaryPassword()), []);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Clave copiada");
    } catch {
      toast.error("No se pudo copiar. Seleccionala y copiala a mano.");
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createUserAction(formData);
    if (res.success) {
      toast.success("Agente municipal registrado con éxito");
      (e.target as HTMLFormElement).reset();
      setPassword(generateTemporaryPassword());
      if (onSuccess) onSuccess();
      router.refresh();
    } else {
      toast.error(res.error || "Error al crear el usuario");
    }
    setLoading(false);
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-xs bg-card text-card-foreground">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" /> Nuevo Agente Municipal
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Complete los datos del funcionario para asignarle credenciales de acceso.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-foreground">Nombre Completo</Label>
              <Input id="name" name="name" required placeholder="Ej: Lic. Bautista Pino" className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-foreground">Correo Electrónico Oficial</Label>
              <Input id="email" name="email" type="email" required placeholder="ejemplo@tresdefebrero.gov.ar" className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-foreground">Contraseña Temporal</Label>
              <div className="flex gap-1.5">
                <Input
                  id="password"
                  name="password"
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8, con letras y números"
                  className="h-10 rounded-xl bg-muted/30 border-border/60 text-xs font-mono"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generateTemporaryPassword())} title="Generar otra" aria-label="Generar otra clave" className="h-10 w-10 shrink-0 rounded-xl">
                  <Dices className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={copyPassword} disabled={!password} title="Copiar" aria-label="Copiar clave" className="h-10 w-10 shrink-0 rounded-xl">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Copiala y pasásela a la persona. La cambia por una propia la primera vez que ingresa.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-xs font-bold text-foreground">Rol Institucional</Label>
              <select
                id="role"
                name="role"
                required
                className="flex h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="areaId" className="text-xs font-bold text-foreground">Área Municipal Responsable</Label>
              <select
                id="areaId"
                name="areaId"
                className="flex h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Ninguna / Administración General Global</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-2xl font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            <span>{loading ? "Registrando Agente..." : "Registrar Agente Municipal"}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
