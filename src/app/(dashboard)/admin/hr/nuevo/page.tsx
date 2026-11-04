export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canEditHR } from "@/lib/hr-labels";
import { PageHeader } from "@/components/layout/page-header";
import { CreateHRForm } from "../create-hr-form";

export const metadata = { title: "Nuevo agente" };

export default async function NewAgentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canEditHR(session.user.role)) redirect("/admin/hr");

  const areas = await prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo agente" description="Cargá los datos de la persona para crear su legajo." icon={UserPlus} />
      <CreateHRForm areas={areas} />
    </div>
  );
}
