"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import { homePathFor } from "@/lib/permissions";
import { changeOwnPasswordAction, type ChangePasswordResult } from "./actions";

type Field = "current" | "next" | "confirm";

const LABELS: Record<Field, string> = {
  current: "Contraseña actual",
  next: "Contraseña nueva",
  confirm: "Repetí la contraseña nueva",
};

const AUTOCOMPLETE: Record<Field, string> = { current: "current-password", next: "new-password", confirm: "new-password" };

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const forced = Boolean(session?.user?.mustChangePassword);
  const [values, setValues] = useState<Record<Field, string>>({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ field?: Field; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res: ChangePasswordResult = await changeOwnPasswordAction(values).catch(() => ({
      success: false as const,
      error: "No se pudo cambiar la contraseña. Probá de nuevo.",
    }));
    if (!res.success) {
      setSaving(false);
      setError({ field: res.field, message: res.error });
      return;
    }
    toast.success("Contraseña cambiada");
    // La sesión se actualiza para que deje de pedir el cambio.
    await update().catch(() => {});
    window.location.assign(homePathFor(session?.user?.role));
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-20 animate-in fade-in duration-500">
      <PageHeader
        title="Cambiar mi contraseña"
        description="Elegí una contraseña que solo sepas vos."
        icon={KeyRound}
      />

      {forced && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-foreground">
            <span className="font-bold">Antes de seguir, cambiá tu contraseña.</span> La que tenés la cargó un administrador.
          </p>
        </div>
      )}

      <Card className="rounded-2xl border border-border/60">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {(Object.keys(LABELS) as Field[]).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`clave-${field}`} className="text-xs font-bold">
                  {LABELS[field]}
                </Label>
                <Input
                  id={`clave-${field}`}
                  type={show ? "text" : "password"}
                  autoComplete={AUTOCOMPLETE[field]}
                  required
                  value={values[field]}
                  onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                  aria-invalid={error?.field === field || undefined}
                  aria-describedby={error?.field === field ? "clave-error" : undefined}
                  className="h-11 rounded-xl"
                />
                {field === "next" && (
                  <p className="text-xs text-muted-foreground">
                    Al menos {PASSWORD_MIN_LENGTH} caracteres, con letras y números.
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
            </button>

            {error && (
              <p id="clave-error" role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {error.message}
              </p>
            )}

            <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Guardar contraseña nueva
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
