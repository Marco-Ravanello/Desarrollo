"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { deleteProviderAction } from "@/app/(dashboard)/admin/actions/provider-actions";

export function DeleteProviderButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProviderAction(id);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Proveedor eliminado");
    setOpen(false);
    router.push("/admin/providers");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar proveedor</DialogTitle>
          <DialogDescription>
            Se va a eliminar {name}. Esta acción no se puede deshacer y queda registrada en la auditoría.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
