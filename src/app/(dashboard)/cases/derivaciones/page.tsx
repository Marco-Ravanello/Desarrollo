export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, Inbox, Send, History } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getDerivationInbox } from "@/services/derivations";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DerivationCard } from "@/components/cases/derivations";

export default async function DerivationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [inbox, area] = await Promise.all([
    getDerivationInbox(session.user),
    session.user.areaId ? prisma.area.findUnique({ where: { id: session.user.areaId }, select: { name: true } }) : null,
  ]);
  const scopeLabel = inbox.scoped && area ? `Los que recibió o derivó ${area.name}.` : "Los de todas las áreas.";

  const tabs = [
    { id: "responder", label: "Para responder", icon: Inbox, rows: inbox.toAnswer, canRespond: true, empty: "No hay derivaciones esperando tu respuesta." },
    { id: "enviadas", label: "Enviadas", icon: Send, rows: inbox.sent, canRespond: false, empty: "Todavía no se derivaron expedientes." },
    { id: "recibidas", label: "Respondidas", icon: History, rows: inbox.received, canRespond: false, empty: "Todavía no se respondieron derivaciones." },
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Expedientes y Casos", href: "/cases" },
          { label: "Derivaciones", active: true },
        ]}
      />
      <PageHeader
        title="Derivaciones entre áreas"
        description={`${scopeLabel} El área que recibe acepta o rechaza; mientras tanto, el expediente sigue en el área que lo derivó.`}
        icon={ArrowRightLeft}
        actions={
          <Button variant="ghost" size="icon" asChild className="rounded-xl">
            <Link href="/cases" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      <Tabs defaultValue="responder" className="space-y-4">
        <TabsList className="h-auto flex-wrap rounded-xl">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 rounded-lg text-xs font-bold">
              <t.icon className="h-3.5 w-3.5" /> {t.label} ({t.rows.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            {t.rows.length === 0 ? (
              <EmptyMessage kind={t.canRespond ? "done" : "empty"} title={t.empty} icon={t.icon} className="rounded-2xl border-2 border-dashed border-border/60" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {t.rows.map((d) => (
                  <DerivationCard key={d.id} d={d} canRespond={t.canRespond} showCase />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
