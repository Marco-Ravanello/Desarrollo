import { getAgreements } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Building2, User, Landmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";
import { formatFecha } from "@/lib/fechas";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { agreementState, canCreateAgreements } from "@/lib/convenios";
import { AgreementEndLabel, AgreementStatusBadge } from "@/components/agreements/agreement-status";

export const metadata = { title: "Convenios" };

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ areaId?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const canCreate = canCreateAgreements(session.user.role);
  const today = todayInArgentina();
  const { areaId } = await searchParams;
  let agreements = await getAgreements();

  if (areaId) {
    agreements = agreements.filter(a => a.areaId === areaId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convenios"
        description="Los convenios de la Muni, con su vigencia y su monto."
        icon={Landmark}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/admin/agreements/new">
                <Plus className="mr-2 h-4 w-4" /> Nuevo convenio
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4">
        {agreements.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="p-0">
              <EmptyMessage
                icon={FileText}
                title="Todavía no hay convenios cargados"
                description={
                  canCreate
                    ? "Los convenios que cargues aparecen acá, con su vigencia y su monto."
                    : "Los cargan Administración General, Dirección General y Superadmin. Cuando haya, aparecen acá."
                }
                action={
                  canCreate ? (
                    <Button asChild size="sm" className="rounded-xl text-xs">
                      <Link href="/admin/agreements/new">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Cargar el primero
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          agreements.map((agreement) => {
            const state = agreementState(agreement, today);
            return (
            <Link key={agreement.id} href={`/admin/agreements/${agreement.id}`}>
            <Card className="overflow-hidden hover:shadow-md transition-all border-none shadow-sm bg-card cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{agreement.title}</h3>
                      <AgreementStatusBadge state={state} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {agreement.number || "Sin número"}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {agreement.parties || "Sin partes cargadas"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {agreement.area?.name || "Sin área"}
                      </div>
                      <AgreementEndLabel state={state} />
                    </div>
                  </div>
                  <div className="text-right">
                    {agreement.amount !== null && Number(agreement.amount) > 0 && (
                      <div className="text-xl font-bold text-foreground">
                        ${Number(agreement.amount).toLocaleString('es-AR')}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Registrado el {formatFecha(agreement.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
