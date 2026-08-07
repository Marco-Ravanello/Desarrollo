export const dynamic = "force-dynamic";
import { getAreas } from "@/services/cases";
import { CreateAgreementForm } from "./create-agreement-form";

export default async function NewAgreementPage() {
  const areas = await getAreas();

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight">Registro de Convenio</h2>
        <p className="text-muted-foreground mb-8">Complete los datos para formalizar el nuevo acuerdo en el sistema.</p>
        <CreateAgreementForm areas={areas} />
      </div>
    </div>
  );
}
