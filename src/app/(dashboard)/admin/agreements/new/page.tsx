export const dynamic = "force-dynamic";
import { getAreas } from "@/services/cases";
import { CreateAgreementForm } from "./create-agreement-form";
import { PageHeader } from "@/components/layout/page-header";
import { Landmark } from "lucide-react";

export const metadata = { title: "Nuevo convenio" };

export default async function NewAgreementPage({ searchParams }: { searchParams: Promise<{ areaId?: string }> }) {
  const areas = (await getAreas()).map((a) => ({ id: a.id, name: a.name }));
  // Desde la tarjeta de un área en Convenios, el área ya viene elegida.
  const { areaId } = await searchParams;
  const defaultAreaId = areas.some((a) => a.id === areaId) ? areaId! : "";

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Nuevo convenio"
          description="Completá los datos del convenio para cargarlo."
          icon={Landmark}
          className="mb-8"
        />
        <CreateAgreementForm areas={areas} defaultAreaId={defaultAreaId} />
      </div>
    </div>
  );
}
