import { ListPageSkeleton } from "@/components/layout/page-skeletons";

// Solo para la lista: el curso y su asistencia tienen su propia carga.
export default function Loading() {
  return <ListPageSkeleton stats={0} filters={2} columns={7} actions={1} />;
}
