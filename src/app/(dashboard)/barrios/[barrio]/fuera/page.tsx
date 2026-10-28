export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { auth } from "@/auth";
import { barrioFromSlug, barrioSlug } from "@/lib/barrios";
import { formatNumber, plural } from "@/lib/formato";
import { FUERA_LIMIT, getPersonasFuera } from "@/services/barrios";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyMessage } from "@/components/ui/empty-message";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Params = { params: Promise<{ barrio: string }> };

export async function generateMetadata({ params }: Params) {
  const barrio = barrioFromSlug((await params).barrio);
  return { title: barrio ? `Puntos fuera de ${barrio}` : "Barrio" };
}

const escrito = (barrio: string | null, localidad: string | null) => [barrio, localidad].filter(Boolean).join(" · ") || "Sin barrio ni localidad";

/**
 * Las personas de un barrio cuyo punto cae fuera de su límite: para revisar si la dirección está mal
 * ubicada o si el barrio está mal cargado en el padrón.
 */
export default async function PuntosFueraPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const barrio = barrioFromSlug((await params).barrio);
  if (!barrio) notFound();
  const slug = barrioSlug(barrio);
  const back = `/barrios/${slug}?ver=mapa`;
  const { total, personas, tieneLimite } = await getPersonasFuera(barrio);
  const caenEnOtro = personas.filter((p) => p.caeEn).length;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Barrios", href: "/barrios" },
          { label: barrio, href: back },
          { label: "Puntos fuera del límite", active: true },
        ]}
      />
      <PageHeader
        title={`Puntos fuera de ${barrio}`}
        description="Personas que en el padrón figuran en este barrio pero cuyo punto en el mapa cae afuera de su límite. Suele ser una dirección mal ubicada o un barrio mal cargado."
        icon={MapPinOff}
        actions={
          <Button variant="ghost" asChild className="rounded-xl gap-1.5 font-bold text-xs">
            <Link href={back}><ArrowLeft className="h-4 w-4" /> Volver al mapa</Link>
          </Button>
        }
      />

      {!tieneLimite ? (
        <EmptyMessage icon={MapPinOff} title="Este barrio todavía no tiene límite" description="La conducción lo puede dibujar desde la pestaña Mapa del barrio." />
      ) : personas.length === 0 ? (
        <EmptyMessage kind="done" icon={MapPinOff} title="Todos los puntos caen dentro del barrio" />
      ) : (
        <>
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <p>
              {plural(total, "persona tiene", "personas tienen")} el punto fuera del límite
              {caenEnOtro > 0 && <> ({formatNumber(caenEnOtro)} caen dentro de otro barrio)</>}.
              {total > personas.length && ` Se muestran las primeras ${formatNumber(FUERA_LIMIT)}, ordenadas por dirección.`}
            </p>
            <p className="mt-1">
              Para corregir, abrí la ficha y usá “Editar datos”: si la dirección está mal, al cambiarla se vuelve a ubicar; si el
              barrio está mal, cambialo por el barrio donde cae.
            </p>
          </div>
          <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>En el padrón dice</TableHead>
                    <TableHead>El punto cae en</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personas.map((p) => (
                    <TableRow key={p.dni}>
                      <TableCell>
                        <Link href={`/people/${p.dni}`} className="font-semibold text-foreground hover:text-primary hover:underline">{p.nombre || "Sin nombre"}</Link>
                        <p className="text-xs text-muted-foreground">DNI {p.dni}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.direccion || <span className="text-muted-foreground/70">Sin dirección</span>}
                        {p.aproximado && <p className="text-xs text-amber-700 dark:text-amber-300">Punto aproximado (sin altura)</p>}
                      </TableCell>
                      <TableCell className="text-sm">{escrito(p.barrioEscrito, p.localidad)}</TableCell>
                      <TableCell className="text-sm">
                        {p.caeEn ? (
                          <Link href={`/barrios/${barrioSlug(p.caeEn)}?ver=mapa`} className="font-semibold text-primary hover:underline">{p.caeEn}</Link>
                        ) : (
                          <span className="text-muted-foreground">Ningún barrio con límite</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <MobileList label="Puntos fuera del límite">
              {personas.map((p) => (
                <MobileListItem
                  key={p.dni}
                  href={`/people/${p.dni}`}
                  title={p.nombre || "Sin nombre"}
                  subtitle={p.direccion || "Sin dirección"}
                  meta={`Dice ${escrito(p.barrioEscrito, p.localidad)} · cae en ${p.caeEn ?? "ningún barrio con límite"}`}
                />
              ))}
            </MobileList>
          </Card>
        </>
      )}
    </div>
  );
}
