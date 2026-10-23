"use client";

import { createContext, useContext, useEffect } from "react";
import { DEFAULT_MUNICIPAL_SETTINGS, toPublicSettings, type PublicMunicipalSettings } from "@/types/settings";

const MunicipalSettingsContext = createContext<PublicMunicipalSettings>(toPublicSettings(DEFAULT_MUNICIPAL_SETTINGS));

/** Los datos de Configuración, iguales en todas las compus porque vienen de la base. */
export function MunicipalSettingsProvider({ settings, children }: { settings: PublicMunicipalSettings; children: React.ReactNode }) {
  useEffect(() => {
    // Antes se guardaban en cada navegador; esa copia ya no se usa.
    try { localStorage.removeItem("muni-system-settings"); } catch {}
  }, []);
  return <MunicipalSettingsContext.Provider value={settings}>{children}</MunicipalSettingsContext.Provider>;
}

export function useMunicipalSettings(): PublicMunicipalSettings {
  return useContext(MunicipalSettingsContext);
}
