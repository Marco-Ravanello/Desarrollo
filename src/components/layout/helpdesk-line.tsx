"use client";

import { Phone } from "lucide-react";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";

/** "Si sigue pasando, avisá a Mesa de ayuda: …", con el teléfono cargado en Configuración. Sin teléfono, no se muestra. */
export function HelpdeskLine({ phone }: { phone?: string }) {
  const settings = useMunicipalSettings();
  const value = (phone ?? settings.helpdeskPhone).trim();
  if (!value) return null;
  return (
    <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
      <Phone className="h-3.5 w-3.5 shrink-0" /> Si sigue pasando, avisá a Mesa de ayuda: <span className="font-semibold text-foreground">{value}</span>
    </p>
  );
}
