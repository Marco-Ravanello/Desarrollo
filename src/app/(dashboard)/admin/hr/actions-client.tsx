"use client";

import { useState } from "react";
import { deleteHRRecordAction } from "../actions/hr-actions";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserMinus, Edit } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteHRAction({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAction = async (e: Event) => {
    e.preventDefault(); // Evitar que el dropdown se cierre inmediatamente
    if (!confirm("¿Está seguro que desea dar de baja a este agente?")) return;

    setLoading(true);
    const res = await deleteHRRecordAction(agentId);
    if (res.success) {
      toast.success("Agente dado de baja");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  return (
    <DropdownMenuItem
      className="rounded-xl px-3 py-2.5 gap-3 font-bold text-rose-600 focus:bg-rose-500 focus:text-white transition-all cursor-pointer"
      onSelect={handleAction}
      disabled={loading}
    >
      <UserMinus className="h-4 w-4" /> {loading ? "Procesando..." : "Dar de Baja"}
    </DropdownMenuItem>
  );
}

export function EditHRAction() {
  return (
    <DropdownMenuItem
        className="rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer"
        onSelect={(e) => {
            e.preventDefault();
            toast.info("Funcionalidad de edición en desarrollo para la próxima versión.");
        }}
    >
        <Edit className="h-4 w-4" /> Editar Legajo
    </DropdownMenuItem>
  );
}
