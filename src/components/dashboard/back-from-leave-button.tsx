"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markBackFromLeaveAction } from "@/app/(dashboard)/admin/actions/hr-actions";

/** "Ya volvió": pasa a la persona a Activo sin entrar a Recursos Humanos. */
export function BackFromLeaveButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (!confirm(`¿${name} ya volvió? Pasa a Activo en Recursos Humanos.`)) return;
    startTransition(async () => {
      const res = await markBackFromLeaveAction(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} pasó a Activo.`);
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label={`${name} ya volvió`}
      className="h-7 shrink-0 gap-1 rounded-lg px-2 text-xs font-semibold"
    >
      <UserCheck className="h-3.5 w-3.5" aria-hidden /> {pending ? "Guardando…" : "Ya volvió"}
    </Button>
  );
}
