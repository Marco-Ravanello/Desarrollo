export interface MunicipalSettings {
  municipalityName: string;
  provinceName: string;
  secretariatName: string;
  directionName: string;
  mayorName: string;
  secretaryName: string;
  mainPhone: string;
  emergencyPhone: string;
  officialEmail: string;
  officialWebsite: string;
  headquartersAddress: string;
  customLogoUrl: string;
  sessionTimeout: string;
  aiAnonymization: boolean;
  maintenanceMode: boolean;
}

export const DEFAULT_MUNICIPAL_SETTINGS: MunicipalSettings = {
  municipalityName: "Municipalidad de Tres de Febrero",
  provinceName: "Provincia de Buenos Aires • República Argentina",
  secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
  directionName: "Dirección General de Gestión Social y Hábitat",
  mayorName: "Lic. Diego Valenzuela (Intendente Municipal)",
  secretaryName: "Lic. Bautista Pino (Secretario General)",
  mainPhone: "0800-888-0333 / Línea 147 (Atención al Vecino)",
  emergencyPhone: "Línea 103 (Defensa Civil) • 107 (SAME) • 911",
  officialEmail: "desarrollohumano@tresdefebrero.gov.ar",
  officialWebsite: "https://www.tresdefebrero.gov.ar",
  headquartersAddress: "Juan Bautista Alberdi 4840, Caseros, Tres de Febrero (B1678)",
  customLogoUrl: "",
  sessionTimeout: "8",
  aiAnonymization: true,
  maintenanceMode: false
};
