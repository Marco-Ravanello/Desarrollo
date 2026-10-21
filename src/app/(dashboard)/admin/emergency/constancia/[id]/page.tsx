export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { auth } from "@/auth";
import { canViewStormDeliveries } from "@/lib/permissions";
import { getDeliveryReceipt } from "@/services/storm-receipts";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-layout";

const fechaHora = (iso: string) => {
  const d = new Date(iso);
  const opts = { timeZone: "America/Argentina/Buenos_Aires" } as const;
  return `${d.toLocaleDateString("es-AR", opts)} ${d.toLocaleTimeString("es-AR", { ...opts, hour: "2-digit", minute: "2-digit", hour12: false })} hs`;
};

function Dato({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground print:text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold text-foreground print:text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function Firma({ titulo, lineas }: { titulo: string; lineas: string[] }) {
  return (
    <div className="space-y-6">
      <p className="text-xs font-bold uppercase text-foreground print:text-slate-900">{titulo}</p>
      {lineas.map((l) => (
        <div key={l}>
          <div className="h-8 border-b border-foreground/50 print:border-slate-500" />
          <p className="mt-1 text-[11px] text-muted-foreground print:text-slate-600">{l}</p>
        </div>
      ))}
    </div>
  );
}

export const metadata = { title: "Constancia de entrega" };

/** Constancia imprimible de una entrega de elementos de emergencia, para que firme quien recibe. */
export default async function DeliveryReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canViewStormDeliveries(session.user.role)) redirect("/admin/emergency");

  const { id } = await params;
  const receipt = await getDeliveryReceipt(decodeURIComponent(id));
  if (!receipt) notFound();

  const f = receipt.family;
  const total = receipt.items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      {/* Esta constancia trae sus propias firmas: no se imprime el pie general. */}
      <style>{"@media print { .print-default-footer { display: none !important; } }"}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" asChild className="rounded-xl gap-1.5 font-bold text-xs">
          <Link href="/admin/emergency"><ArrowLeft className="h-4 w-4" /> Volver a Emergencia</Link>
        </Button>
        <PrintButton label="Imprimir constancia" />
      </div>

      <article className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 space-y-6 print:border-0 print:p-0 print:bg-white print:text-slate-900">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4 print:border-slate-300">
          <div className="flex items-center gap-3">
            <FileCheck2 className="h-8 w-8 text-primary print:hidden" />
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight text-foreground print:text-slate-900">
                Constancia de entrega de elementos de emergencia
              </h1>
              <p className="text-xs text-muted-foreground print:text-slate-600">Contingencia climática · Ficha de tormenta</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold text-foreground print:text-slate-900">N° {receipt.number}</p>
            <p className="text-xs text-muted-foreground print:text-slate-600">{fechaHora(receipt.date)}</p>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-slate-700">Datos de la familia</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
            <Dato label="Nombre y apellido" value={f.nombre} />
            <Dato label="DNI" value={f.dni} />
            <Dato label="Domicilio" value={[f.domicilio, f.referencia ? `(Ref: ${f.referencia})` : null].filter(Boolean).join(" ")} />
            <Dato label="Barrio / Localidad" value={f.barrio} />
            <Dato label="Teléfono / contacto" value={f.contacto} />
            <Dato
              label="Grupo familiar"
              value={`${f.grupoFamiliar ? "Con grupo familiar a cargo" : "Sin grupo familiar a cargo"}${Number(f.ninos) > 0 ? ` · ${f.ninos} niños` : ""}`}
            />
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-slate-700">Elementos entregados</h2>
          <table className="w-full text-sm border border-border/60 print:border-slate-400">
            <thead className="bg-muted/40 print:bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 font-bold border-b border-border/60 print:border-slate-400">Elemento</th>
                <th className="text-right px-3 py-2 font-bold border-b border-border/60 print:border-slate-400 w-28">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((i) => (
                <tr key={i.name}>
                  <td className="px-3 py-2 border-b border-border/40 print:border-slate-300">{i.name}</td>
                  <td className="px-3 py-2 text-right font-bold border-b border-border/40 print:border-slate-300">{i.quantity}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2 font-bold">Total de unidades</td>
                <td className="px-3 py-2 text-right font-bold">{total}</td>
              </tr>
            </tbody>
          </table>
          {receipt.observaciones && (
            <p className="text-sm"><span className="font-bold">Observaciones:</span> {receipt.observaciones}</p>
          )}
          <p className="text-xs text-muted-foreground print:text-slate-600">
            Entrega registrada por {receipt.deliveredBy} en MuniGestión 3F.
          </p>
        </section>

        <p className="text-sm font-semibold">Recibí de conformidad los elementos detallados.</p>

        <section className="grid grid-cols-1 gap-8 pt-4 sm:grid-cols-2 print:grid-cols-2 break-inside-avoid">
          <Firma titulo="Recibió" lineas={["Firma", "Aclaración", "DNI"]} />
          <Firma titulo="Entregó (agente municipal)" lineas={["Firma", "Aclaración", "Legajo / Área"]} />
        </section>
      </article>
    </div>
  );
}
