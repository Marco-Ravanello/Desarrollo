"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFechaHora } from "@/lib/fechas";
import { TemporaryPasswordButton } from "./temporary-password-button";
import { dismissPasswordHelpAction } from "../actions/user-actions";

export type HelpRequestItem = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  requestedAt: string;
};

/** Pedidos de clave temporal hechos desde la pantalla de ingreso (idea 106). Solo lo ve el Superadmin. */
export function PasswordHelpRequests({ requests }: { requests: HelpRequestItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!requests.length) return null;

  const dismiss = (id: string) =>
    startTransition(async () => {
      const res = await dismissPasswordHelpAction(id).catch(() => null);
      if (!res?.success) toast.error(res?.error || "No se pudo descartar el pedido.");
      else router.refresh();
    });

  return (
    <section id="pedidos-de-clave" aria-labelledby="pedidos-de-clave-titulo" className="scroll-mt-24 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 id="pedidos-de-clave-titulo" className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
        <KeyRound className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
        {requests.length === 1 ? "1 persona pidió una clave temporal" : `${requests.length} personas pidieron una clave temporal`}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        La pidieron desde la pantalla de ingreso. Antes de pasar la clave, confirmá que sea la persona, por ejemplo llamándola.
      </p>
      <ul className="mt-3 divide-y divide-amber-500/20">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.name || r.username || r.email || "Sin nombre"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.username ? `Usuario ${r.username} · ` : ""}Pedido el {formatFechaHora(r.requestedAt)}
              </p>
            </div>
            <TemporaryPasswordButton userId={r.id} userName={r.name || r.username || "esta persona"} />
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => dismiss(r.id)} className="h-8 gap-1 rounded-xl text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" aria-hidden /> Descartar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
