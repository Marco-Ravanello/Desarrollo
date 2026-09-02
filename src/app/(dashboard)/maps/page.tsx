export const dynamic = "force-dynamic";
import { getPeople } from "@/services/people";
import { Card } from "@/components/ui/card";
import { MapPin, Users } from "lucide-react";
import { DynamicMapView } from "@/components/maps/dynamic-map-view";

export default async function MapsPage() {
  const people = await getPeople();
  const peopleWithCoords = people.filter(p => p.latitude && p.longitude);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-foreground">Mapa Social</h2>
          <p className="text-muted-foreground text-lg">Visualización geoespacial de la vulnerabilidad y cobertura.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30">
              <Users className="h-6 w-6 text-blue-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Ciudadanos</p>
              <p className="text-2xl font-black">{people.length}</p>
           </div>
        </div>

        <div className="flex items-center gap-4 p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm">
           <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
              <MapPin className="h-6 w-6 text-emerald-600" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Georreferenciados</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black">{peopleWithCoords.length}</p>
                <p className="text-xs font-bold text-emerald-600">
                  {people.length > 0 ? (peopleWithCoords.length / people.length * 100).toFixed(0) : 0}%
                </p>
              </div>
           </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-card/50 backdrop-blur-md border border-border/30">
        <DynamicMapView people={people} />
      </Card>
    </div>
  );
}
