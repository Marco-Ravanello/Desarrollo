import { ListPageSkeleton } from "@/components/layout/page-skeletons";

export default function CasesLoading() {
  return <ListPageSkeleton actions={3} filters={4} columns={6} />;
}
