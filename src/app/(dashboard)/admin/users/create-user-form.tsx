"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createUserAction } from "../actions/user-actions";
import type { Role } from "@prisma/client";
import { UserPlus, RefreshCw, Copy, Dices } from "lucide-react";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { ROLE_INFO, ROLE_ORDER } from "@/lib/roles";
import { suggestUsername, USERNAME_MAX } from "@/lib/username";

const fieldClass = "h-10 rounded-xl bg-muted/30 border-border/60 text-sm";
const selectClass =
  "flex h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

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
  const [username, setUsername] = useState("");
  // Mientras no lo toquen, el usuario se sugiere a partir del nombre.
  const [usernameEdited, setUsernameEdited] = useState(false);
  // Arranca en el rol con menos acceso de la gestión diaria, nunca en Superadmin.
  const [role, setRole] = useState<Role>("OPERATIVO");

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
      toast.success("Usuario creado. Ya puede ingresar con la clave temporal.");
      (e.target as HTMLFormElement).reset();
      setUsername("");
      setUsernameEdited(false);
      setRole("OPERATIVO");
      setPassword(generateTemporaryPassword());
      if (onSuccess) onSuccess();
      router.refresh();
    } else {
      toast.error(res.error || "No se pudo crear el usuario.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-bold text-foreground">Nombre y apellido</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Ej: María Pérez"
          className={fieldClass}
          onChange={(e) => {
            if (!usernameEdited) setUsername(suggestUsername(e.target.value));
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-xs font-bold text-foreground">Usuario</Label>
        <Input
          id="username"
          name="username"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          value={username}
          onChange={(e) => {
            setUsernameEdited(true);
            setUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
          }}
          placeholder="Ej: maria.perez"
          className={`${fieldClass} font-mono`}
        />
        <p className="text-xs text-muted-foreground">Con este nombre ingresa a la app. Sin espacios ni tildes.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-bold text-foreground">
          Correo <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="email" name="email" type="email" placeholder="nombre@tresdefebrero.gob.ar" className={`${fieldClass} font-mono`} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-bold text-foreground">Clave temporal</Label>
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
            className={`${fieldClass} font-mono`}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generateTemporaryPassword())} title="Generar otra" aria-label="Generar otra clave" className="h-10 w-10 shrink-0 rounded-xl">
            <Dices className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={copyPassword} disabled={!password} title="Copiar" aria-label="Copiar clave" className="h-10 w-10 shrink-0 rounded-xl">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Copiala y pasásela a la persona. La cambia por una propia la primera vez que ingresa.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role" className="text-xs font-bold text-foreground">Rol</Label>
        <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value as Role)} className={selectClass}>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_INFO[r].label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{ROLE_INFO[role].description}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="areaId" className="text-xs font-bold text-foreground">Área</Label>
        <select id="areaId" name="areaId" className={selectClass}>
          <option value="">Sin área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-11 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2">
        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        <span>{loading ? "Creando…" : "Crear usuario"}</span>
      </Button>
    </form>
  );
}
