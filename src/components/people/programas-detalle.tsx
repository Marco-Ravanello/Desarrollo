import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Baby, HeartHandshake, Home, Layers, MapPin, Phone } from "lucide-react";
import type { FichaSocialProgramaDetalle } from "@/services/ficha-social";
import { plural } from "@/lib/formato";

/** Detalle de cada programa social que cobra la persona, tal como figura en el padrón. */
export function ProgramasDetalle({
  detalle,
  nombreTitular,
}: {
  detalle?: Record<string, FichaSocialProgramaDetalle>;
  nombreTitular?: string;
}) {
  const programas = Object.entries(detalle || {});
  if (programas.length === 0) {
    return (
      <EmptyMessage
        compact
        title="No figura en ningún programa social"
        description="Si cobra alguno, aparece acá cuando se importa el padrón."
        icon={Layers}
        className="rounded-2xl border border-dashed border-border/60"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {programas.map(([progName, d]) => (
        <Card key={progName} className="bg-muted/30 border border-border/40 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/30 bg-muted/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <HeartHandshake className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground leading-tight">{progName}</h3>
                {d.roles.filter(Boolean).length > 0 && (
                  <p className="text-xs text-muted-foreground font-medium">Rol: {d.roles.filter(Boolean).join(", ")}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-xs border-border/60 font-bold shrink-0">
              {plural(d.cantidad_registros, "registro")}
            </Badge>
          </div>
          <CardContent className="p-4 space-y-3">
            {d.registros.map((reg, rIdx) => (
              <div key={rIdx} className="space-y-2 text-xs">
                {reg.datos_beneficiario?.nombre && reg.datos_beneficiario.nombre !== nombreTitular && (
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/30 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Baby className="h-3.5 w-3.5 text-primary" /> Beneficiario a cargo:
                    </span>
                    <span className="font-bold text-foreground">
                      {reg.datos_beneficiario.nombre} (DNI {reg.datos_beneficiario.dni || "sin dato"})
                    </span>
                  </div>
                )}

                {reg.datos_contacto && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    {reg.datos_contacto.telefono && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-foreground font-medium">{reg.datos_contacto.telefono}</span>
                      </div>
                    )}
                    {reg.datos_contacto.direccion && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-foreground font-medium">{reg.datos_contacto.direccion}</span>
                      </div>
                    )}
                    {reg.datos_contacto.barrio && (
                      <div className="flex items-center gap-1.5">
                        <Home className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-foreground font-medium">Barrio {reg.datos_contacto.barrio}</span>
                      </div>
                    )}
                  </div>
                )}

                {reg.datos_adicionales && Object.keys(reg.datos_adicionales).length > 0 && (
                  <div className="pt-2 border-t border-border/20 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {Object.entries(reg.datos_adicionales).map(([k, v]) => (
                      <div key={k} className="bg-background/40 px-2 py-1 rounded-lg">
                        <span className="text-muted-foreground font-semibold">{k}:</span>{" "}
                        <span className="text-foreground font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
