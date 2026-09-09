export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreas } from "@/services/cases";
import { getPersonById } from "@/services/people";
import prisma from "@/lib/prisma";
import { NewCaseForm } from "./new-case-form";
import { FolderPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function NewCasePage({
  searchParams
}: {
  searchParams: Promise<{ areaId?: string; personId?: string; dni?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { areaId, personId, dni } = await searchParams;

  const areas = await getAreas();

  let preselectedPerson = null;

  if (personId) {
    preselectedPerson = await getPersonById(personId);
  } else if (dni) {
    const raw = await prisma.person.findUnique({
      where: { dni }
    });
    if (raw) {
      preselectedPerson = await getPersonById(raw.id);
    }
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 shrink-0">
            <Link href="/cases">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Creación Centralizada de Expediente
              </h1>
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                Nuevo Legajo 3F
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registro asistido de actuaciones sociales, asignación de área y carátula oficial.
            </p>
          </div>
        </div>
      </div>

      <NewCaseForm
        areas={areas as any}
        preselectedAreaId={areaId}
        preselectedPerson={formattedPerson}
      />
    </div>
  );
}
