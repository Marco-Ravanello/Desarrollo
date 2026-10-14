export const dynamic = "force-dynamic";
import { getAreas } from "@/services/cases";
import { CreateAgreementForm } from "./create-agreement-form";
import { PageHeader } from "@/components/layout/page-header";
import { Landmark } from "lucide-react";

export default async function NewAgreementPage() {
  const areas = await getAreas();

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Registro de Convenio"
          description="Complete los datos para formalizar el nuevo acuerdo en el sistema."
          icon={Landmark}
          className="mb-8"
        />
        <CreateAgreementForm areas={areas} />
      </div>
    </div>
  );
}
