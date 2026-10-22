import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreatePersonForm } from "./create-person-form";
import { getAddressOptions } from "@/services/person-data";

export const metadata = { title: "Cargar persona" };

export const dynamic = "force-dynamic";

export default async function NewPersonPage() {
  const options = await getAddressOptions();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cargar persona"
        description="Completá los datos para sumar a la persona al Registro Único."
        icon={UserPlus}
      />

      <CreatePersonForm options={options} />
    </div>
  );
}
