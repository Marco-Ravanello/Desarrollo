import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreatePersonForm } from "./create-person-form";

export default function NewPersonPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alta de Persona"
        description="Ingrese los datos para registrar a un nuevo ciudadano en el sistema único."
        icon={UserPlus}
      />

      <CreatePersonForm />
    </div>
  );
}
