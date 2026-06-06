export const dynamic = "force-dynamic";
import { getPeople } from "@/services/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { DynamicMapView } from "@/components/maps/dynamic-map-view";

export default async function MapsPage() {
  const people = await getPeople();
  const peopleWithCoords = people.filter(p => p.latitude && p.longitude);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mapa Social</h2>
          <p className="text-slate-500">Distribución geográfica de ciudadanos y familias.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-slate-500">Total Ciudadanos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{people.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-slate-500">Georreferenciados</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peopleWithCoords.length}</div>
            <p className="text-xs text-slate-500 mt-1">{(peopleWithCoords.length / people.length * 100).toFixed(0)}% del total</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <DynamicMapView people={people} />
      </Card>
    </div>
  );
}
