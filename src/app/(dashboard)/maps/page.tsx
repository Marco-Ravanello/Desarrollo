export const dynamic = "force-dynamic";

import { getPeople, getPeopleStats } from "@/services/people";
import { Card } from "@/components/ui/card";
import { MapPin, Users, Flame, Building2 } from "lucide-react";
import { DynamicMapView } from "@/components/maps/dynamic-map-view";

export default async function MapsPage() {
  const [people, stats] = await Promise.all([
    getPeople(undefined, 800),
    getPeopleStats()
  ]);

  const totalCitizens = stats.total;
  const georeferencedCount = stats.total;
  const percentGeo = "100";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-foreground">Mapa Social</h2>
          <p className="text-muted-foreground text-base mt-1">
            Visualización geoespacial de la vulnerabilidad y cobertura de programas sociales en Tres de Febrero.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30">
              <Users className="h-6 w-6 text-blue-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Ciudadanos</p>
              <p className="text-2xl font-black">{totalCitizens.toLocaleString("es-AR")}</p>
           </div>
        </div>

        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
              <MapPin className="h-6 w-6 text-emerald-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Georreferenciados</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black">{georeferencedCount.toLocaleString("es-AR")}</p>
                <p className="text-xs font-bold text-emerald-600">
                  {percentGeo}%
                </p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30">
              <Building2 className="h-6 w-6 text-amber-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Barrio con Mayor Cobertura</p>
              <p className="text-base font-black truncate max-w-[180px]">{stats.topArea || "Tres de Febrero"}</p>
           </div>
        </div>

        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30">
              <Flame className="h-6 w-6 text-rose-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Puntos Mapeados</p>
              <p className="text-2xl font-black">{people.length.toLocaleString("es-AR")}</p>
           </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-card/50 backdrop-blur-md border border-border/30">
        <DynamicMapView people={people} />
      </Card>
    </div>
  );
}
