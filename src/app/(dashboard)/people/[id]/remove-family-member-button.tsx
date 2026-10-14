"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { removeFromFamily } from "../actions/family-actions";

export function RemoveFamilyMemberButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const result = await removeFromFamily(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${name} ya no figura en este grupo familiar`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudo desvincular. Revisá la conexión y probá de nuevo.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Desvincular a ${name} del grupo familiar`}
          className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
        >
          <UserMinus className="h-4 w-4 shrink-0" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desvincular del grupo familiar</DialogTitle>
          <DialogDescription>
            {name} va a dejar de figurar en este grupo familiar. Su legajo personal no se borra.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={removing} onClick={handleRemove}>
            {removing ? "Desvinculando..." : "Desvincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
