export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPinned } from "lucide-react";
import { auth } from "@/auth";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { GeocodingPanel } from "@/components/maps/geocoding-panel";
import { getGeocodingStatus } from "@/services/geocoding";

export const metadata = { title: "Ubicar en el mapa" };

export default async function UbicarEnElMapaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!MANAGEMENT_ROLES.includes(session.user.role)) redirect("/maps");

  const status = await getGeocodingStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubicar en el mapa"
        description="Busca las direcciones del padrón en Georef (el servicio oficial de direcciones) y, si no aparecen, en OpenStreetMap. Las que no se encuentran quedan abajo para corregir la dirección o marcar el punto a mano."
        icon={MapPinned}
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/maps">
              <ArrowLeft className="h-4 w-4" /> Volver al Mapa Social
            </Link>
          </Button>
        }
      />
      <GeocodingPanel initialStatus={status} />
    </div>
  );
}
