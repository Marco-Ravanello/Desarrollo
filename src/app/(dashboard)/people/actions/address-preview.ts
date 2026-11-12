"use server";

import { auth } from "@/auth";
import { canEditSocialRecords } from "@/lib/permissions";
import { previewAddress } from "@/services/geocoding";
import type { AddressPreview } from "@/lib/address-preview";

/** Busca la dirección que se está escribiendo para mostrar el punto en el mapa (idea 157). No guarda nada. */
export async function previewAddressAction(direccion: string, localidad: string, barrio: string): Promise<AddressPreview> {
  const session = await auth();
  if (!session?.user?.id || !canEditSocialRecords(session.user.role)) return { status: "SIN_SERVICIO" };
  const clip = (s: unknown) => (typeof s === "string" ? s.slice(0, 200) : "");
  try {
    return await previewAddress(clip(direccion), clip(localidad) || null, clip(barrio) || null);
  } catch (error) {
    console.error("No se pudo buscar la dirección:", error);
    return { status: "SIN_SERVICIO" };
  }
}
