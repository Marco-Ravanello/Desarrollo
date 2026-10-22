export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreas } from "@/services/cases";
import { getPersonById } from "@/services/people";
import prisma from "@/lib/prisma";
import { NewCaseForm } from "./new-case-form";
import { FolderPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Nuevo expediente" };

export default async function NewCasePage({
  searchParams
}: {
  searchParams: Promise<{ areaId?: string; personId?: string; dni?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { areaId, personId, dni } = await searchParams;

  const areas = await getAreas();
  // Arranca con el área pedida (botón "Nuevo expediente" de una página de área) o con la de quien carga.
  // Si no hay ninguna, queda vacía y hay que elegirla: antes quedaba la primera por orden alfabético.
  const isArea = (id?: string | null) => Boolean(id && areas.some((a) => a.id === id));
  const defaultAreaId = isArea(areaId) ? areaId : isArea(session.user.areaId) ? session.user.areaId! : undefined;

  let preselectedPerson = null;
  if (personId) {
    preselectedPerson = await getPersonById(personId);
  } else if (dni) {
    preselectedPerson = await getPersonById(dni);
  }

  const formattedPerson = preselectedPerson
    ? {
        id: preselectedPerson.id,
        dni: preselectedPerson.dni,
        firstName: preselectedPerson.firstName,
        lastName: preselectedPerson.lastName,
        address: preselectedPerson.address || null,
        barrio: (preselectedPerson as any).barrio || null,
        phone: preselectedPerson.phone || null,
        email: preselectedPerson.email || null,
        programasActivos: (preselectedPerson as any).programasActivos || []
      }
    : null;

  const breadcrumbs = [
    { label: "Expedientes", href: "/cases" },
    { label: "Nuevo expediente", active: true }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <PageBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Nuevo expediente"
        description="Elegí a la persona y el área, y contá en pocas palabras por qué se abre."
        icon={FolderPlus}
        actions={
          <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 shrink-0">
            <Link href="/cases" aria-label="Volver">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
          </Button>
        }
      />

      <NewCaseForm
        areas={areas as any}
        preselectedAreaId={defaultAreaId}
        preselectedPerson={formattedPerson}
      />
    </div>
  );
}
