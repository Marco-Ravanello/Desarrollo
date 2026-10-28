"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrollCandidateAction } from "@/app/(dashboard)/people/actions/program-requirements-actions";

/** "Dar de alta" con un toque, con la fecha de hoy. La persona sale de la lista al recargar. */
export function EnrollCandidateButton({ dni, name, column, programLabel }: { dni: string; name: string; column: string; programLabel: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  const onClick = () => {
    if (!confirm(`¿Dar de alta a ${name} en ${programLabel}, con fecha de hoy?`)) return;
    startTransition(async () => {
      const res = await enrollCandidateAction(dni, column);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setDone(true);
      toast.success(`${name} quedó de alta en ${programLabel}.`);
      router.refresh();
    });
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" aria-hidden /> De alta
      </span>
    );
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending} className="h-8 rounded-xl gap-1 text-xs font-bold">
      <UserPlus className="h-3.5 w-3.5" aria-hidden /> {pending ? "Guardando…" : "Dar de alta"}
    </Button>
  );
}
