"use client";

import { useState } from "react";
import Link from "next/link";
import { CASE_STATUS_LABEL } from "@/lib/case-summary";
import { CASE_STATUS_TONE, STORM_PRIORITY_TONE, toneOf } from "@/lib/status-tones";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyMessage } from "@/components/ui/empty-message";
import { CloudRain, FolderOpen, MessageSquareText, PackageCheck, ArrowRight, MapPin } from "lucide-react";
import type { FichaHistorial } from "@/services/ficha-social";
import { formatFecha } from "@/lib/fechas";

const fecha = formatFecha;

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" /> {children}
    </h3>
  );
}

/** Cantidad total de cosas en el historial, para la pestaña. */
export function historialCount(h?: FichaHistorial) {
  return h ? h.expedientes.length + h.intervencionesTotal + h.fichasTormenta.length : 0;
}

/** Con `withCases={false}` muestra solo intervenciones y fichas de emergencia (los expedientes van en su propia pestaña). */
export function FichaHistorialView({ historial, withCases = true }: { historial: FichaHistorial; withCases?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const { expedientes, intervenciones, intervencionesTotal, fichasTormenta } = historial;
  const visibleInterventions = showAll ? intervenciones : intervenciones.slice(0, 8);

  if ((withCases ? historialCount(historial) : intervencionesTotal + fichasTormenta.length) === 0) {
    return (
      <EmptyMessage
        compact
        title="Todavía no tiene atención municipal registrada"
        description="Cuando tenga expedientes, intervenciones o fichas de emergencia, aparecen acá."
        icon={FolderOpen}
        className="rounded-2xl border-2 border-dashed border-border/60"
      />
    );
  }

  return (
    <div className="space-y-8">
      {withCases && (
        <section className="space-y-3">
          <SectionTitle icon={FolderOpen}>Expedientes ({expedientes.length})</SectionTitle>
          {expedientes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tiene expedientes.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {expedientes.map((c) => {
                return (
                  <li key={c.id}>
                    <Link
                      href={`/cases/${c.id}`}
                      className="block h-full rounded-2xl border border-border/50 bg-muted/30 p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-foreground leading-snug">{c.titulo}</p>
                        <StatusBadge tone={toneOf(CASE_STATUS_TONE, c.estado)}>{CASE_STATUS_LABEL[c.estado] ?? c.estado}</StatusBadge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {c.area} · Prioridad {c.prioridad.toLowerCase()} · abierto el {fecha(c.abierto)}
                        {c.estado !== "CERRADO" ? ` · último movimiento ${fecha(c.actualizado)}` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle icon={MessageSquareText}>Intervenciones ({intervencionesTotal})</SectionTitle>
        {intervenciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tiene intervenciones registradas.</p>
        ) : (
          <>
            <ol className="relative space-y-4 border-l border-border/60 pl-5">
              {visibleInterventions.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <p className="text-xs font-bold text-muted-foreground">
                    {fecha(i.fecha)}
                    {i.tipo ? ` · ${i.tipo}` : ""}
                    {i.area ? ` · ${i.area}` : ""}
                    {i.usuario ? ` · ${i.usuario}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground leading-relaxed whitespace-pre-line">{i.descripcion}</p>
                  {i.expediente && (
                    <Link href={`/cases/${i.expedienteId}`} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
                      {i.expediente}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
            {intervenciones.length > 8 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="text-xs font-bold text-primary">
                {showAll ? "Ver menos" : `Ver todas (${intervenciones.length})`}
              </Button>
            )}
            {intervencionesTotal > intervenciones.length && (
              <p className="text-xs text-muted-foreground">
                Se muestran las {intervenciones.length} más recientes de {intervencionesTotal}. Las demás están en cada expediente.
              </p>
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={CloudRain}>Emergencia climática ({fichasTormenta.length})</SectionTitle>
        {fichasTormenta.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tiene fichas de tormenta.</p>
        ) : (
          <ul className="space-y-3">
            {fichasTormenta.map((f) => (
              <li key={f.id} className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">Ficha de tormenta del {fecha(f.fecha)}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /> {f.domicilio}
                      {f.relevadoPor ? ` · relevó ${f.relevadoPor}` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={toneOf(STORM_PRIORITY_TONE, f.prioridad)}>Prioridad {f.prioridad.toLowerCase()}</StatusBadge>
                </div>
                <p className="text-xs text-foreground">
                  <span className="font-semibold text-muted-foreground">Pidió:</span> {f.pedido}
                </p>
                {f.entregas.length === 0 ? (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Todavía no recibió entregas.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {f.entregas.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-xs">
                        <PackageCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-foreground">
                          <b>{fecha(e.fecha)}:</b> recibió {e.elementos}
                          <span className="text-muted-foreground"> · entregó {e.entregadoPor}</span>
                          {e.observaciones ? <span className="text-muted-foreground"> · {e.observaciones}</span> : null}
                          {" · "}
                          <Link href={`/admin/emergency/constancia/${e.id}`} target="_blank" className="font-semibold text-primary hover:underline">
                            Ver constancia
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {withCases && historial.personaId && (
        <Button variant="outline" asChild className="rounded-xl text-xs font-bold">
          <Link href={`/people/${historial.personaId}`}>
            Ver la ficha completa <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}
