// La ficha de cada niño, niña o adolescente de un convenio por horas: los datos del acompañamiento.
// Los datos personales (nombre, DNI, nacimiento, domicilio, teléfono) están en el Registro Único y el padrón.
// No hay adulto responsable: los chicos del convenio de cuidadoras están separados de su familia
// (abandono o maltrato) y la que los acompaña es la cuidadora.

export const FICHA_LIMITS = { motivo: 1000, interviene: 200, obraSocial: 120, observaciones: 2000 };

export type FichaNnya = {
  motivo: string | null;
  interviene: string | null;
  obraSocial: string | null;
  observaciones: string | null;
};

const texto = (v: unknown, max: number) => {
  const t = String(v ?? "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
  return t || null;
};

/** Limpia los datos del acompañamiento. Todos son opcionales. */
export function parseFichaNnya(raw: Record<string, unknown>): { ok: true; data: FichaNnya } {
  return {
    ok: true,
    data: {
      motivo: texto(raw.motivo, FICHA_LIMITS.motivo),
      interviene: texto(raw.interviene, FICHA_LIMITS.interviene),
      obraSocial: texto(raw.obraSocial, FICHA_LIMITS.obraSocial),
      observaciones: texto(raw.observaciones, FICHA_LIMITS.observaciones),
    },
  };
}

const NOMBRES: Record<keyof FichaNnya, string> = {
  motivo: "Motivo del ingreso",
  interviene: "Quién interviene",
  obraSocial: "Obra social",
  observaciones: "Observaciones",
};

/** Qué cambió en la ficha, sin los valores (son datos sensibles): para Auditoría. */
export function camposCambiados(antes: FichaNnya, despues: FichaNnya): string[] {
  return (Object.keys(NOMBRES) as (keyof FichaNnya)[]).filter((k) => (antes[k] ?? null) !== (despues[k] ?? null)).map((k) => NOMBRES[k]);
}
