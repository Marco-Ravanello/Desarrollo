import { ListPageSkeleton } from "@/components/layout/page-skeletons";

/** Pantalla de carga de Barrios y de la página de cada barrio. */
export default function Loading() {
  return <ListPageSkeleton stats={0} filters={0} columns={6} actions={0} />;
}
