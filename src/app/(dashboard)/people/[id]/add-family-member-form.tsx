"use client";

import { useState } from "react";
import { addFamilyMember } from "../actions/family-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

export function AddFamilyMemberForm({ personId }: { personId: string }) {
  const [loading, setLoading] = useState(false);
  const [dni, setDni] = useState("");
  const [relationship, setRelationship] = useState("Familiar a cargo");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dni.trim()) return;

    setLoading(true);
    try {
      const res = await addFamilyMember(personId, dni, relationship);
      if (res.success) {
        toast.success("Miembro vinculado correctamente");
        setDni("");
      } else {
        toast.error(res.error || "Error al vincular miembro");
      }
    } catch (error: any) {
      toast.error("Error al vincular miembro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-border/60 p-4 rounded-2xl bg-muted/20">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Vincular Familiar</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="memberDni" className="text-[11px] font-bold text-muted-foreground">DNI del Familiar</Label>
          <Input
            id="memberDni"
            placeholder="Ingrese DNI..."
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            required
            className="bg-background h-9 text-xs rounded-xl border-border/60"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="relationship" className="text-[11px] font-bold text-muted-foreground">Parentesco / Vínculo</Label>
          <select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full h-9 px-3 rounded-xl bg-background border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="Hijo/a">Hijo/a</option>
            <option value="Cónyuge / Pareja">Cónyuge / Pareja</option>
            <option value="Padre / Madre">Padre / Madre</option>
            <option value="Hermano/a">Hermano/a</option>
            <option value="Abuelo/a">Abuelo/a</option>
            <option value="Nieto/a">Nieto/a</option>
            <option value="Familiar a cargo">Familiar a cargo</option>
            <option value="Tutor / Guardador">Tutor / Guardador</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={loading} size="sm" className="w-full h-9 rounded-xl font-bold text-xs gap-2">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        <span>{loading ? "Vincunlando..." : "Vincular Integrante al Grupo Familiar"}</span>
      </Button>
    </form>
  );
}
