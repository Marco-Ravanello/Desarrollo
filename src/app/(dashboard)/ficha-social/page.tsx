import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cleanDni } from "@/services/ficha-social";
import { LoadingPage, SkeletonHeader } from "@/components/layout/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { FichaSearch } from "./ficha-search";

// La ficha de cada persona vive en /people/[dni]; acá queda el buscador.
// Los enlaces viejos (/ficha-social?dni=…) llevan directo a esa ficha.
export default async function FichaSocialPage({ searchParams }: { searchParams: Promise<{ dni?: string }> }) {
  const { dni } = await searchParams;
  const clean = cleanDni(dni || "");
  if (clean.length >= 4) redirect(`/people/${clean}`);

  return (
    <Suspense
      fallback={
        <LoadingPage label="Cargando la Ficha Social 360°…">
          <SkeletonHeader actions={1} />
          <Skeleton className="h-[88px] w-full rounded-2xl" />
        </LoadingPage>
      }
    >
      <FichaSearch />
    </Suspense>
  );
}
