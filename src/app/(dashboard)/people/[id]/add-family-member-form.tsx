"use client";

import { useState } from "react";
import { addFamilyMember } from "../actions/family-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";

export function AddFamilyMemberForm({ personId }: { personId: string }) {
  const [loading, setLoading] = useState(false);
  const [dni, setDni] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dni) return;

    setLoading(true);
    try {
      const res = await addFamilyMember(personId, dni);
      toast.success("Miembro vinculado correctamente");
      setDni("");
    } catch (error: any) {
      toast.error(error.message || "Error al vincular miembro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="h-4 w-4 text-blue-500" />
        <h4 className="text-sm font-bold">Vincular Familiar</h4>
      </div>
      <div className="space-y-2">
        <Label htmlFor="memberDni" className="text-xs">DNI del Familiar a vincular</Label>
        <div className="flex gap-2">
          <Input
            id="memberDni"
            placeholder="Ingrese DNI..."
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            required
            className="bg-background"
          />
          <Button type="submit" disabled={loading} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground italic">El familiar debe estar previamente registrado en el sistema.</p>
      </div>
    </form>
  );
}
