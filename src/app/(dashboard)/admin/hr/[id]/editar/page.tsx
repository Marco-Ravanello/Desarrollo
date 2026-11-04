export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canEditHR } from "@/lib/hr-labels";
import { getHRRecordById } from "@/services/hr";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { HRRecordForm } from "../../hr-record-form";

export const metadata = { title: "Editar legajo" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  if (!canEditHR(session.user.role)) redirect(`/admin/hr/${id}`);

  const [agent, areas] = await Promise.all([
    getHRRecordById(id),
    prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!agent) notFound();
  // Al formulario van datos simples: el sueldo como número y sin el área entera (tiene montos Decimal).
  const { area: _area, salary, ...rest } = agent;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Recursos" },
          { label: "Recursos Humanos", href: "/admin/hr" },
          { label: `${agent.firstName} ${agent.lastName}`, href: `/admin/hr/${agent.id}` },
          { label: "Editar legajo", active: true },
        ]}
      />
      <PageHeader title="Editar legajo" description={`${agent.firstName} ${agent.lastName} · DNI ${agent.dni}`} icon={UserCog} />
      <HRRecordForm areas={areas} agent={{ ...rest, salary: salary ? Number(salary) : null }} />
    </div>
  );
}
