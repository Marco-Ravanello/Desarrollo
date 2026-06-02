"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createUserAction } from "../actions/user-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Role } from "@prisma/client";

export function CreateUserForm({ areas }: { areas: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createUserAction(formData);
    if (res.success) {
      toast.success("Usuario creado con éxito");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Nuevo Usuario</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña Temporal</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol en el Sistema</Label>
              <select
                id="role"
                name="role"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.values(Role).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaId">Área Responsable</Label>
              <select
                id="areaId"
                name="areaId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Ninguna / Administración General</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando..." : "Crear Usuario"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
