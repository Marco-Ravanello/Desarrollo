import { LoadingPage, SkeletonHeader } from "@/components/layout/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function FichaLoading() {
  return (
    <LoadingPage label="Cargando la Ficha Social 360°…">
      <SkeletonHeader actions={1} />
      <Skeleton className="h-[88px] w-full rounded-2xl" />
    </LoadingPage>
  );
}
