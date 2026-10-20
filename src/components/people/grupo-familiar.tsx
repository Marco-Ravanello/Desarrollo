"use client";

import { ArrowRight, Home, Info, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MAX_MISMO_DOMICILIO, type GrupoFamiliar, type MiembroFamiliar } from "@/services/ficha-social";

// Grupo familiar en la Ficha Social 360°: familiares cargados en los programas
// y personas del padrón con la misma dirección, con lo que la municipalidad hizo con cada una.

export function grupoFamiliarCount(g?: GrupoFamiliar | null): number {
  return g ? g.declarados.length + g.mismoDomicilio.length : 0;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function atencionTexto(a: MiembroFamiliar["atencion"]): string[] {
  const out: string[] = [];
  if (a.expedientes) out.push(`${plural(a.expedientes, "expediente", "expedientes")}${a.expedientesAbiertos ? ` (${a.expedientesAbiertos} ${a.expedientesAbiertos === 1 ? "abierto" : "abiertos"})` : ""}`);
  if (a.intervenciones) out.push(plural(a.intervenciones, "intervención", "intervenciones"));
  if (a.fichasTormenta) out.push(`${plural(a.fichasTormenta, "ficha de tormenta", "fichas de tormenta")}${a.entregas ? ` · ${plural(a.entregas, "entrega", "entregas")}` : ""}`);
  return out;
}

function MiembroCard({ m, onOpen }: { m: MiembroFamiliar; onOpen: (dni: string) => void }) {
  const atencion = atencionTexto(m.atencion);
  const programas = m.programas.slice(0, 3);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {m.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="break-words text-sm font-bold leading-tight text-foreground">{m.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {m.dni ? `DNI ${m.dni}` : "Sin DNI cargado"}
            {m.edad !== null ? ` · ${m.edad} ${m.edad === 1 ? "año" : "años"}` : ""}
          </p>
          <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
            {m.vinculo}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 text-[11px]">
        <p className="font-semibold text-muted-foreground">Programas</p>
        {programas.length ? (
          <div className="flex flex-wrap gap-1">
            {programas.map((p) => (
              <span key={p} className="rounded-lg border border-border/50 bg-background/60 px-2 py-0.5 font-medium text-foreground">{p}</span>
            ))}
            {m.programas.length > programas.length && (
              <span className="px-1 py-0.5 font-semibold text-muted-foreground">+{m.programas.length - programas.length} más</span>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">{m.enPadron ? "Sin programas activos" : "No figura en el padrón"}</p>
        )}
      </div>

      <div className="space-y-1 border-t border-border/30 pt-2 text-[11px]">
        <p className="font-semibold text-muted-foreground">En la municipalidad</p>
        <p className={atencion.length ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {atencion.length ? atencion.join(" · ") : "Sin atención registrada"}
        </p>
      </div>

      {m.dni && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpen(m.dni!)}
          className="mt-auto h-8 w-full gap-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10"
        >
          Ver su Ficha 360° <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-xs text-muted-foreground">{children}</p>;
}

export function GrupoFamiliarView({ grupo, onOpen }: { grupo: GrupoFamiliar; onOpen: (dni: string) => void }) {
  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Se arma con los familiares cargados en los programas y con las personas del padrón que tienen la misma dirección.
          Vivir en la misma dirección no confirma un vínculo familiar.
        </span>
      </p>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-4 w-4" /> Familiares cargados ({grupo.declarados.length})
        </h3>
        {grupo.declarados.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.declarados.map((m, i) => <MiembroCard key={`${m.dni ?? m.nombre}-${i}`} m={m} onOpen={onOpen} />)}
          </div>
        ) : (
          <Nota>Ningún programa cargó familiares de esta persona.</Nota>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Home className="h-4 w-4" /> Viven en el mismo domicilio ({grupo.mismoDomicilio.length})
          {grupo.domicilio && <span className="normal-case tracking-normal font-semibold text-foreground">{grupo.domicilio}</span>}
        </h3>
        {grupo.sinDomicilio === "SIN_DIRECCION" ? (
          <Nota>No tiene dirección cargada, así que no se pueden buscar convivientes.</Nota>
        ) : grupo.sinDomicilio === "SIN_ALTURA" ? (
          <Nota>La dirección no tiene calle y altura, así que no se buscan convivientes (coincidiría con todo el barrio).</Nota>
        ) : grupo.mismoDomicilio.length ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grupo.mismoDomicilio.map((m) => <MiembroCard key={m.dni ?? m.nombre} m={m} onOpen={onOpen} />)}
            </div>
            {grupo.personasEnDomicilio > MAX_MISMO_DOMICILIO && (
              <Nota>
                Esta dirección figura para {grupo.personasEnDomicilio} personas más en el padrón, así que puede ser un edificio o un
                complejo sin número de departamento. Se muestran las primeras {MAX_MISMO_DOMICILIO}.
              </Nota>
            )}
          </>
        ) : grupo.personasEnDomicilio > 0 ? (
          <Nota>Las personas con esta dirección ya figuran entre los familiares cargados.</Nota>
        ) : (
          <Nota>Nadie más del padrón figura con esta dirección.</Nota>
        )}
      </section>
    </div>
  );
}

