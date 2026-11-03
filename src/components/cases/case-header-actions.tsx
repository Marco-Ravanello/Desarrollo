"use client";

import Link from "next/link";
import { PlusCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pedirNuevaIntervencion } from "@/components/cases/new-intervention-signal";

/** Abre el formulario de intervención (en la pestaña Historia) y lo deja listo para escribir. */
export function NewInterventionButton() {
  return (
    <Button onClick={pedirNuevaIntervencion} className="w-full gap-1.5 rounded-xl font-bold md:w-auto">
      <PlusCircle className="h-4 w-4" /> Nueva intervención
    </Button>
  );
}

/** Lleva a la versión para imprimir del expediente, con el membrete de la Municipalidad. */
export function PrintCaseButton({ caseId }: { caseId: string }) {
  return (
    <Button asChild variant="outline" className="gap-1.5 rounded-xl font-bold">
      <Link href={`/cases/${encodeURIComponent(caseId)}/imprimir`}>
        <Printer className="h-4 w-4" /> Imprimir expediente
      </Link>
    </Button>
  );
}
