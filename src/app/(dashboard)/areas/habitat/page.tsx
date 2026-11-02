export const dynamic = "force-dynamic";

import { AreaPage, type AreaSearchParams } from "@/components/areas/area-page";

export const metadata = { title: "Hábitat y Vivienda" };

export default async function HabitatAreaPage({ searchParams }: { searchParams: AreaSearchParams }) {
  return <AreaPage slug="habitat" searchParams={searchParams} />;
}
