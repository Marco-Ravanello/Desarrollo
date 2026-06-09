"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createPersonAction } from "../actions/create-person";
import { MapPin } from "lucide-react";

export function CreatePersonForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await createPersonAction(formData);
      if (result.success) {
        toast.success("Persona registrada con éxito");
        router.push(`/people/${result.id}`);
      } else {
        toast.error(result.error || "Error al registrar persona");
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Información Personal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dni">DNI / Identificación</Label>
              <Input id="dni" name="dni" placeholder="Ej: 12345678" required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
              <Input id="birthDate" name="birthDate" type="date" required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombres</Label>
              <Input id="firstName" name="firstName" placeholder="Ej: Juan" required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellidos</Label>
              <Input id="lastName" name="lastName" placeholder="Ej: Pérez" required className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Opcional)</Label>
              <Input id="email" name="email" type="email" placeholder="juan@ejemplo.com" className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" placeholder="Ej: 011 4444-5555" required className="bg-background" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Dirección / Domicilio</Label>
              <Input id="address" name="address" placeholder="Ej: Calle Falsa 123, Localidad" required className="bg-background" />
              <p className="text-[10px] text-muted-foreground italic">La ubicación en el mapa se generará automáticamente a partir de la dirección.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? "Registrando..." : "Registrar Persona"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
