export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CopyCheck, Gauge, Home, MapPinned, Phone } from "lucide-react";
import { auth } from "@/auth";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { PADRON_GAPS, share, type PadronGap } from "@/lib/padron-quality";
import { formatNumber, plural } from "@/lib/formato";
import { getPadronQuality } from "@/services/padron-quality";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Calidad de datos del padrón" };

function pctText(part: number, total: number): string {
  const p = share(part, total);
  if (part > 0 && p < 0.1) return "menos del 0,1 %";
  if (part < total && p > 99.9) return "más del 99,9 %";
  return `${p.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

/** Barra que muestra qué parte del padrón es (el número y el porcentaje van al lado, en texto). */
function Meter({ part, total }: { part: number; total: number }) {
  const width = total ? Math.max(part > 0 ? 1 : 0, Math.min(100, (part / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-primary/70 dark:bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

function GapRow({ gap, count, total }: { gap: PadronGap; count: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold text-foreground">{PADRON_GAPS[gap].label}</span>
        <span className="text-sm tabular-nums">
          <span className="font-bold text-foreground">{formatNumber(count)}</span>{" "}
          <span className="text-muted-foreground">· {pctText(count, total)}</span>
        </span>
      </div>
      <Meter part={count} total={total} />
      <p className="text-xs text-muted-foreground">{PADRON_GAPS[gap].hint}</p>
      {count > 0 && (
        <Link href={`/people?falta=${gap}`} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          Ver a quiénes <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function QualityCard({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <div className="flex-1 space-y-4">{children}</div>
      {action && <div className="border-t border-border/40 pt-3">{action}</div>}
    </Card>
  );
}

export default async function PadronQualityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!MANAGEMENT_ROLES.includes(session.user.role)) redirect("/people");

  const q = await getPadronQuality();

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Registro Único", href: "/people" },
          { label: "Calidad de datos", active: true },
        ]}
      />
      <PageHeader
        title="Calidad de datos del padrón"
        description="Cuántas personas del padrón tienen datos incompletos y dónde se corrigen. Se cuenta en el momento, cada vez que entrás."
        icon={Gauge}
        actions={
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
            <Link href="/people" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Con los datos completos</p>
            <p className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {formatNumber(q.completos)}{" "}
              <span className="text-base font-semibold text-muted-foreground">de {plural(q.total, "persona")}</span>
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{pctText(q.completos, q.total)}</p>
        </div>
        <Meter part={q.completos} total={q.total} />
        <p className="text-xs text-muted-foreground">Completos quiere decir con dirección con altura, teléfono y punto en el mapa.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <QualityCard icon={Home} title="Dirección">
          <GapRow gap="direccion" count={q.sinDireccion} total={q.total} />
          <GapRow gap="altura" count={q.sinAltura} total={q.total} />
          <p className="text-xs text-muted-foreground">Se corrige en la ficha de cada persona, con el botón Editar datos.</p>
        </QualityCard>

        <QualityCard icon={Phone} title="Teléfono">
          <GapRow gap="telefono" count={q.sinTelefono} total={q.total} />
          <p className="text-xs text-muted-foreground">Se completa en la ficha de cada persona, con el botón Editar datos.</p>
        </QualityCard>

        <QualityCard
          icon={MapPinned}
          title="Ubicación en el mapa"
          action={
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold">
              <Link href="/maps/ubicar">Ubicar en el mapa</Link>
            </Button>
          }
        >
          <GapRow gap="ubicacion" count={q.sinUbicar} total={q.total} />
          {q.sinUbicar > 0 && (
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {[
                { label: "Falta buscarlas", value: q.ubicacion.porBuscar },
                { label: "No se encontraron", value: q.ubicacion.noEncontradas },
                { label: "Sin dirección para buscar", value: q.ubicacion.sinDireccion },
              ].map((d) => (
                <div key={d.label} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="text-base font-bold text-foreground tabular-nums">{formatNumber(d.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </QualityCard>

        <QualityCard
          icon={CopyCheck}
          title="Posibles repetidos"
          action={
            q.paresDuplicados > 0 ? (
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold">
                <Link href="/people/duplicados">Revisar los posibles repetidos</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-1.5">
            <p className="font-heading text-3xl font-bold text-foreground tabular-nums">{formatNumber(q.paresDuplicados)}</p>
            <p className="text-sm text-foreground">
              {q.paresDuplicados === 1 ? "par de personas para revisar" : "pares de personas para revisar"}
            </p>
            <p className="text-xs text-muted-foreground">
              Mismo nombre y distinto DNI, con la misma fecha de nacimiento, el mismo domicilio o un DNI casi igual.
              Los que ya se marcaron como personas distintas no se cuentan.
            </p>
          </div>
        </QualityCard>
      </div>
    </div>
  );
}
