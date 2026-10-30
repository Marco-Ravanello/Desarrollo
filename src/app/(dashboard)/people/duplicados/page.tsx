export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CopyCheck, Users } from "lucide-react";
import { auth } from "@/auth";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { MAX_NAME_GROUP, findPadronDuplicates } from "@/services/padron-duplicates";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Button } from "@/components/ui/button";
import { DuplicatePairCard } from "@/components/people/padron-duplicates";

const LIMIT = 200;

export const metadata = { title: "Posibles duplicados" };

export default async function PadronDuplicatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!MANAGEMENT_ROLES.includes(session.user.role)) redirect("/people");

  const { pairs, total, skippedNames } = await findPadronDuplicates({ limit: LIMIT });

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Registro Único", href: "/people" },
          { label: "Posibles duplicados", active: true },
        ]}
      />
      <PageHeader
        title="Posibles duplicados del padrón"
        description="Personas con el mismo nombre y DNI distinto que además tienen la misma fecha de nacimiento, el mismo domicilio o un DNI casi igual. Revisá cada par: unilas en una sola o marcá que son personas distintas."
        icon={CopyCheck}
        actions={
          <Button variant="ghost" size="icon" asChild className="rounded-xl">
            <Link href="/people" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      {skippedNames > 0 && (
        <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {skippedNames === 1 ? "Un nombre aparece" : `${skippedNames} nombres aparecen`} más de {MAX_NAME_GROUP} veces con DNI distintos
          (por ejemplo, nombres genéricos o incompletos). Esos no se comparan acá.
        </p>
      )}

      {total === 0 ? (
        <EmptyMessage
          kind="done"
          title="No hay posibles duplicados para revisar"
          icon={Users}
          className="rounded-2xl border-2 border-dashed border-border/60"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total === 1 ? "Hay 1 par para revisar." : `Hay ${total.toLocaleString("es-AR")} pares para revisar.`}
            {total > pairs.length && ` Se muestran los primeros ${pairs.length}; al resolverlos aparecen los siguientes.`}
          </p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pairs.map((pair) => (
              <DuplicatePairCard key={`${pair.a.dni}-${pair.b.dni}`} pair={pair} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
