export const dynamic = "force-dynamic";

import { AreaPage, type AreaSearchParams } from "@/components/areas/area-page";

export const metadata = { title: "Niñez, Adolescencia y Familia" };

export default async function NinezAreaPage({ searchParams }: { searchParams: AreaSearchParams }) {
  return <AreaPage slug="ninez" searchParams={searchParams} />;
}
