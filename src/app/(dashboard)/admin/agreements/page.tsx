import { getAgreements } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Calendar, Building2, User, Landmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ areaId?: string }> }) {
  const { areaId } = await searchParams;
  let agreements = await getAgreements();

  if (areaId) {
    agreements = agreements.filter(a => a.areaId === areaId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convenios"
        description="Registro y seguimiento de acuerdos institucionales."
        icon={Landmark}
        actions={
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/admin/agreements/new">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Convenio
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        {agreements.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="p-0">
              <EmptyMessage icon={FileText} title="No se han registrado convenios todavía." />
            </CardContent>
          </Card>
        ) : (
          agreements.map((agreement) => (
            <Link key={agreement.id} href={`/admin/agreements/${agreement.id}`}>
            <Card className="overflow-hidden hover:shadow-md transition-all border-none shadow-sm bg-card cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{agreement.title}</h3>
                      <Badge variant={agreement.status === 'VIGENTE' ? 'default' : 'secondary'} className={agreement.status === 'VIGENTE' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : ''}>
                        {agreement.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {agreement.number || "Sin número"}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {agreement.parties || "No especificado"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {agreement.area?.name || "Global"}
                      </div>
                      {agreement.endDate && (
                        <div className="flex items-center gap-1 text-rose-600 font-medium">
                          <Calendar className="h-3 w-3" /> Vence: {new Date(agreement.endDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {agreement.amount && (
                      <div className="text-xl font-bold text-foreground">
                        ${Number(agreement.amount).toLocaleString('es-AR')}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                      Registrado el {new Date(agreement.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
