export const dynamic = "force-dynamic";

import { AreaPage, type AreaSearchParams } from "@/components/areas/area-page";

export const metadata = { title: "Protección Social" };

export default async function SocialAreaPage({ searchParams }: { searchParams: AreaSearchParams }) {
  return <AreaPage slug="social" searchParams={searchParams} />;
}
