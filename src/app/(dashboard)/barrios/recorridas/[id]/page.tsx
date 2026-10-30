export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Footprints } from "lucide-react";
import { auth } from "@/auth";
import { canAccessPath, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { barrioSlug, type Barrio3F } from "@/lib/barrios";
import { formatFecha } from "@/lib/fechas";
import { formatNumber, plural } from "@/lib/formato";
import {
  RECORRIDA_ESTADOS, canDeleteRecorrida, canManageRecorrida, canPlanRecorridas, visitaResultadoLabel, type RecorridaEstado,
} from "@/lib/recorridas";
import { getBarrioMapData } from "@/services/barrios";
import { fechaDeRecorrida, getRecorrida, getRecorridaUserOptions } from "@/services/recorridas";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RECORRIDA_ESTADO_TONE, toneOf } from "@/lib/status-tones";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { PrintButton } from "@/components/ui/print-layout";
import { BarrioMapLoader } from "@/components/barrios/barrio-map-loader";
import {
  AddVisitaForm, DeleteRecorridaButton, EditRecorridaDialog, TerminarRecorridaDialog, VisitaItem,
} from "@/components/barrios/recorrida-controls";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const rec = await getRecorrida((await params).id);
  return { title: rec ? `Recorrida del ${fechaDeRecorrida(rec.fecha)} · ${rec.barrio}` : "Recorrida" };
}

/** Una recorrida: la lista para imprimir o llevar en el celular, lo anotado en cada casa y lo que se encontró. */
export default async function RecorridaPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const rec = await getRecorrida((await params).id);
  if (!rec) notFound();
  const user = session.user;
  const slug = barrioSlug(rec.barrio);
  const back = `/barrios/${slug}?ver=recorridas`;
  const canManage = canManageRecorrida(user, rec);
  const canMark = canPlanRecorridas(user.role);
  const done = rec.estado === "HECHA";
  const canSeeMap = canAccessPath(user.role, "/maps");

  const counts = {
    visitadas: rec.visitas.filter((v) => v.resultado === "VISITADA").length,
    sinVisitar: rec.visitas.filter((v) => v.resultado === "PENDIENTE").length,
  };
  const otras = rec.visitas.length - counts.visitadas - counts.sinVisitar;
  const stops = rec.visitas
    .filter((v) => v.lat !== null && v.lng !== null)
    .map((v) => ({
      n: v.orden,
      lat: v.lat!,
      lng: v.lng!,
      nombre: v.nombre,
      direccion: v.direccion,
      resultado: v.resultado,
      resultadoLabel: visitaResultadoLabel(v.resultado),
      dni: v.dni,
    }));
  const [mapData, userOptions] = await Promise.all([
    canSeeMap && stops.length ? getBarrioMapData(rec.barrio as Barrio3F, { canViewSensitive: hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES) }) : null,
    canManage ? getRecorridaUserOptions() : [],
  ]);
  const fecha = fechaDeRecorrida(rec.fecha);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Barrios", href: "/barrios" },
          { label: rec.barrio, href: back },
          { label: `Recorrida del ${fecha}`, active: true },
        ]}
      />
      {/* El membrete lo pone el marco de la app al imprimir; acá va solo el título de la lista. */}
      <div className="hidden text-slate-900 print:block">
        <h1 className="text-lg font-bold uppercase tracking-tight">Recorrida por {rec.barrio}</h1>
        <p className="text-xs text-slate-600">
          {fecha} · Salen: {rec.equipo.map((e) => e.name).join(", ")}{rec.objetivo ? ` · ${rec.objetivo}` : ""}
        </p>
      </div>
      <div className="print:hidden">
        <PageHeader
          title={`Recorrida por ${rec.barrio}`}
          description={`${fecha}${rec.objetivo ? ` · ${rec.objetivo}` : ""}. Salen: ${rec.equipo.map((e) => e.name).join(", ") || "sin equipo"}.${rec.createdBy ? ` La armó ${rec.createdBy}.` : ""}`}
          icon={Footprints}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={toneOf(RECORRIDA_ESTADO_TONE, rec.estado)}>
                {RECORRIDA_ESTADOS[rec.estado as RecorridaEstado] ?? rec.estado}
              </StatusBadge>
              <PrintButton label="Imprimir la lista" />
              {canManage && (
                <EditRecorridaDialog id={rec.id} barrio={rec.barrio} fecha={rec.fecha} objetivo={rec.objetivo} equipoIds={rec.equipoIds} userOptions={userOptions} />
              )}
              {canManage && !done && (
                <TerminarRecorridaDialog id={rec.id} barrio={rec.barrio} hallazgos={rec.hallazgos} pendientes={rec.pendientes} done={false} sinVisitar={counts.sinVisitar} />
              )}
              {canDeleteRecorrida(user, rec) && <DeleteRecorridaButton id={rec.id} backHref={back} />}
              <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
                <Link href={back} aria-label={`Volver a ${rec.barrio}`}><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
            </div>
          }
        />
      </div>

      <div className="print:hidden">
        <StatRow>
          <StatCard label="Para visitar" value={formatNumber(rec.visitas.length)} icon={Footprints} tone="blue" hint="Casas en la lista" />
          <StatCard label="Visitadas" value={formatNumber(counts.visitadas)} tone="green" hint={rec.visitas.length ? `${Math.round((counts.visitadas / rec.visitas.length) * 100)} % de la lista` : undefined} />
          <StatCard label="No estaban u otro" value={formatNumber(otras)} tone="orange" hint="Para volver a intentar" />
          <StatCard label="Sin anotar" value={formatNumber(counts.sinVisitar)} tone="purple" hint={done ? "Quedaron sin visitar" : "Todavía no se anotó qué pasó"} />
        </StatRow>
      </div>

      {done && (
        <Card className="shadow-none print:hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Lo que se encontró</CardTitle>
              {rec.terminadaAt && <CardDescription>Terminada el {formatFecha(rec.terminadaAt)}.</CardDescription>}
            </div>
            {canManage && (
              <TerminarRecorridaDialog id={rec.id} barrio={rec.barrio} hallazgos={rec.hallazgos} pendientes={rec.pendientes} done sinVisitar={counts.sinVisitar} />
            )}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Qué se encontró</h3>
              <p className="whitespace-pre-line text-sm text-foreground">{rec.hallazgos}</p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Qué quedó pendiente</h3>
              <p className="whitespace-pre-line text-sm text-foreground">{rec.pendientes || <span className="text-muted-foreground">Nada anotado.</span>}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {mapData && (
        <Card className="shadow-none print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Las casas en el mapa</CardTitle>
            <CardDescription>
              Con el número de la lista y el color de lo anotado.
              {stops.length < rec.visitas.length && ` ${plural(rec.visitas.length - stops.length, "casa no está", "casas no están")} en el mapa porque falta ubicar la dirección.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarrioMapLoader data={mapData} stops={stops} canOpenPeople={canSeeMap} peopleOnByDefault={false} height={460} />
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none print:hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">La lista</CardTitle>
            <CardDescription>Ordenada por calle. En cada casa, tocá “Anotar la visita” para dejar qué pasó.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="divide-y divide-border/40 rounded-2xl border border-border/60">
            {rec.visitas.map((v) => (
              <VisitaItem key={v.id} recorridaId={rec.id} visita={v} canMark={canMark} />
            ))}
          </ol>
          {canManage && !done && <AddVisitaForm recorridaId={rec.id} />}
        </CardContent>
      </Card>

      {/* Para imprimir: la lista en una tabla con lugar para anotar a mano. */}
      <table className="hidden w-full border-collapse text-[11px] text-slate-900 print:table">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="w-6 py-1 pr-2">N°</th>
            <th className="py-1 pr-2">Persona</th>
            <th className="py-1 pr-2">Dirección y teléfono</th>
            <th className="py-1 pr-2">Por qué</th>
            <th className="w-40 py-1 pr-2">Qué pasó</th>
            <th className="w-48 py-1">Notas</th>
          </tr>
        </thead>
        <tbody>
          {rec.visitas.map((v) => (
            <tr key={v.id} className="break-inside-avoid border-b border-slate-300 align-top">
              <td className="py-1.5 pr-2 font-bold">{v.orden}</td>
              <td className="py-1.5 pr-2">
                <span className="font-semibold">{v.nombre || "Sin nombre"}</span>
                <br />DNI {v.dni}
              </td>
              <td className="py-1.5 pr-2">
                {v.direccion || "Sin dirección"}
                {v.telefono && <><br />Tel. {v.telefono}</>}
              </td>
              <td className="py-1.5 pr-2">{v.motivo}</td>
              <td className="py-1.5 pr-2">
                {v.resultado !== "PENDIENTE" ? visitaResultadoLabel(v.resultado) : "□ Visitada  □ No estaba  □ No quiso  □ Se mudó"}
              </td>
              <td className="py-1.5">{v.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
