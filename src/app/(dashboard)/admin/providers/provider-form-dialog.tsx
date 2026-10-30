"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/form-section";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { saveProviderAction, type ProviderInput } from "@/app/(dashboard)/admin/actions/provider-actions";

type Props = {
  trigger: React.ReactNode;
  initial?: Partial<ProviderInput>;
};

const FIELDS: { name: keyof ProviderInput; label: string; placeholder?: string; required?: boolean; type?: string }[] = [
  { name: "name", label: "Razón social", required: true },
  { name: "cuit", label: "CUIT", placeholder: "30-12345678-9", required: true },
  { name: "address", label: "Domicilio" },
  { name: "phone", label: "Teléfono" },
  { name: "email", label: "Email", type: "email" },
  { name: "bank", label: "Banco" },
  { name: "cbu", label: "CBU", placeholder: "22 dígitos" },
];

export function ProviderFormDialog({ trigger, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const input: ProviderInput = {
      id: initial?.id,
      name: String(form.get("name") || ""),
      cuit: String(form.get("cuit") || ""),
      address: String(form.get("address") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      bank: String(form.get("bank") || ""),
      cbu: String(form.get("cbu") || ""),
    };
    const result = await saveProviderAction(input);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Proveedor actualizado" : "Proveedor registrado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Los datos se usan al cargar órdenes de compra y facturas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.name} className={f.name === "name" || f.name === "address" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                <Label htmlFor={`provider-${f.name}`}>{f.label}{f.required && <RequiredMark />}</Label>
                <Input
                  id={`provider-${f.name}`}
                  name={f.name}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  required={f.required}
                  defaultValue={(initial?.[f.name] as string) || ""}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
