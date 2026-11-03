import { DetailSkeleton } from "@/components/layout/page-skeletons";

/** Pantalla de carga con la forma de la página de detalle. */
export default function Loading() {
  return <DetailSkeleton label="Cargando el convenio…" actions={2} />;
}
