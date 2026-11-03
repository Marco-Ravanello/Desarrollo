import { DetailSkeleton } from "@/components/layout/page-skeletons";

/** Pantalla de carga con la forma de la página de detalle. */
export default function Loading() {
  return <DetailSkeleton label="Cargando el barrio…" actions={1} stats={4} tabs={4} />;
}
