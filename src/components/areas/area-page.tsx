import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessPath } from "@/lib/permissions";
import { AREA_PAGES, canOpenAreaPage, parseAreaCaseFilters, type AreaPageSlug } from "@/lib/area-cases";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export type AreaSearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Página de un área (Protección Social, Niñez, Hábitat o Violencia): la lista va por páginas. */
export async function AreaPage({ slug, searchParams }: { slug: AreaPageSlug; searchParams: AreaSearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  if (!canOpenAreaPage(role, slug, (path) => canAccessPath(role, path))) redirect("/dashboard");

  const config = AREA_PAGES[slug];
  const filters = parseAreaCaseFilters(await searchParams);
  const data = await getAreaDashboardData(config.keywords, filters);

  return (
    <AreaDashboardView
      slug={slug}
      areaTitle={config.title}
      areaDescription={config.description}
      themeColor={config.themeColor}
      area={data.area}
      cases={data.cases.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        priority: c.priority,
        updatedAt: c.updatedAt.toISOString(),
        person: c.person,
        interventions: c._count.interventions,
      }))}
      filters={filters}
      total={data.total}
      totalPages={data.totalPages}
      currentPage={data.currentPage}
      pageSize={data.pageSize}
      stats={data.stats}
      isSensitive={config.sensitive}
    />
  );
}
