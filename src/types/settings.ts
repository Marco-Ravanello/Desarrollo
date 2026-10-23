export interface MunicipalSettings {
  municipalityName: string;
  provinceName: string;
  secretariatName: string;
  directionName: string;
  mayorName: string;
  secretaryName: string;
  mainPhone: string;
  emergencyPhone: string;
  /** Teléfono o interno de quien da soporte de la app: se muestra en las páginas de error. */
  helpdeskPhone: string;
  officialEmail: string;
  officialWebsite: string;
  headquartersAddress: string;
  customLogoUrl: string;
}

export const DEFAULT_MUNICIPAL_SETTINGS: MunicipalSettings = {
  municipalityName: "Municipalidad de Tres de Febrero",
  provinceName: "Provincia de Buenos Aires • República Argentina",
  secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
  directionName: "Dirección General de Desarrollo Humano y Hábitat",
  mayorName: "Lic. Diego Valenzuela (Intendente Municipal)",
  secretaryName: "Lic. Bautista Pino (Secretario General)",
  mainPhone: "0800-888-0333 / Línea 147 (Atención al Vecino)",
  emergencyPhone: "Línea 103 (Defensa Civil) • 107 (SAME) • 911",
  helpdeskPhone: "",
  officialEmail: "desarrollohumano@tresdefebrero.gov.ar",
  officialWebsite: "https://www.tresdefebrero.gov.ar",
  headquartersAddress: "Juan Bautista Alberdi 4840, Caseros, Tres de Febrero (B1678)",
  customLogoUrl: ""
};

export const SETTINGS_KEY = "muni-system-settings";

const FIELDS = Object.keys(DEFAULT_MUNICIPAL_SETTINGS) as (keyof MunicipalSettings)[];

/** Solo los campos conocidos y como texto: lo viejo que quedó guardado (controles que se sacaron) no pasa. */
export function cleanSettings(input: unknown): MunicipalSettings {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out = { ...DEFAULT_MUNICIPAL_SETTINGS };
  for (const k of FIELDS) {
    if (typeof src[k] === "string") out[k] = (src[k] as string).slice(0, k === "customLogoUrl" ? 3_000_000 : 300);
  }
  return out;
}

/** Lo que necesitan las pantallas y las impresiones. El logo propio va aparte (/api/logo) para no mandarlo en cada página. */
export type PublicMunicipalSettings = Omit<MunicipalSettings, "customLogoUrl"> & {
  /** Dirección del logo propio, o null si se usa el de fábrica. */
  logoUrl: string | null;
};

export function toPublicSettings(s: MunicipalSettings): PublicMunicipalSettings {
  const { customLogoUrl, ...rest } = s;
  const logo = customLogoUrl?.trim() ?? "";
  return { ...rest, logoUrl: logo ? `/api/logo?v=${logoVersion(logo)}` : null };
}

/** Un número corto que cambia cuando cambia el logo, para que el navegador no muestre el viejo. */
function logoVersion(logo: string): string {
  let h = 0;
  for (let i = 0; i < logo.length; i += Math.max(1, Math.floor(logo.length / 2000))) h = (h * 31 + logo.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}${logo.length.toString(36)}`;
}
