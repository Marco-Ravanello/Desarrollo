export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, Scale, TriangleAlert } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatNumber, plural } from "@/lib/formato";
import { getBarrioComparison } from "@/services/barrios";
import {
  COMPARE_SORTS, MIN_PEOPLE_TO_COMPARE, comparisonRows, decimalText, highDemandLowCoverage, isCompareSort, per1000, percent, sortComparison,
  type CompareSort, type ComparisonRow,
} from "@/lib/barrio-comparison";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Comparar barrios" };

const pct = (n: number | null) => (n === null ? "—" : `${decimalText(n)} %`);

/** Encabezado que ordena la tabla por esa columna. */
function SortHead({ sort, active, numeric }: { sort: CompareSort; active: CompareSort; numeric?: boolean }) {
  const spec = COMPARE_SORTS[sort];
  const on = sort === active;
  const Icon = spec.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead numeric={numeric} aria-sort={on ? (spec.desc ? "descending" : "ascending") : undefined}>
      <Link
        href={sort === "expedientes" ? "/barrios/comparar" : `/barrios/comparar?orden=${sort}`}
        scroll={false}
        className={cn("inline-flex items-center gap-1 hover:text-primary", on && "font-bold text-primary")}
      >
        {spec.label}
        {on && <Icon className="h-3.5 w-3.5" aria-hidden />}
      </Link>
    </TableHead>
  );
}

export default async function CompararBarriosPage({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { orden } = await searchParams;
  const sort: CompareSort = isCompareSort(orden) ? orden : "expedientes";

  const rows = comparisonRows(await getBarrioComparison({ canViewSensitive: hasPermission(session.user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) }));
  const sorted = sortComparison(rows, sort);
  const attention = highDemandLowCoverage(rows);
  const total = rows.reduce(
    (t, r) => ({
      people: t.people + r.people,
      openCases: t.openCases + r.openCases,
      withPrograms: t.withPrograms + r.withPrograms,
      sinTelefono: t.sinTelefono + r.sinTelefono,
      sinAltura: t.sinAltura + r.sinAltura,
      sinUbicacion: t.sinUbicacion + r.sinUbicacion,
    }),
    { people: 0, openCases: 0, withPrograms: 0, sinTelefono: 0, sinAltura: 0, sinUbicacion: 0 }
  );
  const small = (r: ComparisonRow) => r.people > 0 && r.people < MIN_PEOPLE_TO_COMPARE;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Barrios", href: "/barrios" }, { label: "Comparar barrios", active: true }]} />
      <PageHeader
        title="Comparar barrios"
        icon={Scale}
        description="Los 29 barrios uno al lado del otro: cuántos expedientes abiertos tienen por cada 1.000 personas, cuántas personas están en algún programa y qué datos faltan. Las cuentas son sobre las personas del padrón de cada barrio, porque no hay datos del censo. Podés ordenar por cualquier columna."
      />

      {attention.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden /> Dónde mirar primero
          </p>
          <p className="mt-1 text-foreground/90">
            Muchos expedientes abiertos por persona y pocas personas en programas:{" "}
            {attention.map((r, i) => (
              <span key={r.barrio}>
                {i > 0 && (i === attention.length - 1 ? " y " : ", ")}
                <Link href={`/barrios/${r.slug}`} className="font-semibold text-primary hover:underline">{r.barrio}</Link>{" "}
                <span className="text-muted-foreground">({decimalText(r.casesPer1000)} cada 1.000, {pct(r.coverage)} con programa)</span>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
        <div className="hidden md:block">
          <Table stickyHeader>
            <TableHeader>
              <TableRow>
                <SortHead sort="barrio" active={sort} />
                <SortHead sort="personas" active={sort} numeric />
                <SortHead sort="expedientes" active={sort} numeric />
                <SortHead sort="cobertura" active={sort} numeric />
                <SortHead sort="telefono" active={sort} numeric />
                <SortHead sort="altura" active={sort} numeric />
                <SortHead sort="ubicacion" active={sort} numeric />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.barrio} className={cn(r.people === 0 && "text-muted-foreground")}>
                  <TableCell className="font-semibold">
                    <Link href={`/barrios/${r.slug}`} className="text-foreground hover:text-primary hover:underline">{r.barrio}</Link>
                    {small(r) && <span className="block text-xs font-normal text-muted-foreground">Pocas personas: los porcentajes dicen poco</span>}
                  </TableCell>
                  <TableCell numeric>{r.people ? formatNumber(r.people) : "—"}</TableCell>
                  <TableCell numeric>
                    <span className="font-semibold">{decimalText(r.casesPer1000)}</span>
                    {r.openCases > 0 && <span className="block text-xs text-muted-foreground">{plural(r.openCases, "abierto", "abiertos")}</span>}
                  </TableCell>
                  <TableCell numeric>{pct(r.coverage)}</TableCell>
                  <TableCell numeric>{pct(r.faltaTelefono)}</TableCell>
                  <TableCell numeric>{pct(r.faltaAltura)}</TableCell>
                  <TableCell numeric>{pct(r.faltaUbicacion)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Los 29 barrios</TableCell>
                <TableCell numeric>{formatNumber(total.people)}</TableCell>
                <TableCell numeric>{decimalText(per1000(total.openCases, total.people))}</TableCell>
                <TableCell numeric>{pct(percent(total.withPrograms, total.people))}</TableCell>
                <TableCell numeric>{pct(percent(total.sinTelefono, total.people))}</TableCell>
                <TableCell numeric>{pct(percent(total.sinAltura, total.people))}</TableCell>
                <TableCell numeric>{pct(percent(total.sinUbicacion, total.people))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden">
          <nav aria-label="Ordenar por" className="flex flex-wrap gap-1.5 px-1 pb-3">
            {(["expedientes", "cobertura", "telefono", "personas", "barrio"] as CompareSort[]).map((k) => (
              <Link
                key={k}
                href={k === "expedientes" ? "/barrios/comparar" : `/barrios/comparar?orden=${k}`}
                scroll={false}
                aria-current={k === sort ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  k === sort ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground"
                )}
              >
                {COMPARE_SORTS[k].label}
              </Link>
            ))}
          </nav>
          <MobileList label="Barrios">
            {sorted.map((r) => (
              <MobileListItem
                key={r.barrio}
                href={`/barrios/${r.slug}`}
                title={r.barrio}
                subtitle={r.people ? `${decimalText(r.casesPer1000)} expedientes c/1.000 · ${pct(r.coverage)} con programa` : "Sin personas del padrón"}
                meta={r.people ? `${plural(r.people, "persona")} · ${pct(r.faltaTelefono)} sin teléfono` : undefined}
              />
            ))}
          </MobileList>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Expedientes abiertos: los que no están cerrados, de personas del padrón que viven en el barrio
        {hasPermission(session.user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) ? "" : " (sin los de Violencia de Género)"}. Sin ubicar: sin punto en el Mapa Social.
      </p>
    </div>
  );
}
