export const dynamic = "force-dynamic";

import { AreaPage, type AreaSearchParams } from "@/components/areas/area-page";

export const metadata = { title: "Violencia de Género" };

export default async function ViolenceAreaPage({ searchParams }: { searchParams: AreaSearchParams }) {
  return <AreaPage slug="violence" searchParams={searchParams} />;
}
