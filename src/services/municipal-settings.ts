import { cache } from "react";
import prisma from "@/lib/prisma";
import { DEFAULT_MUNICIPAL_SETTINGS, type MunicipalSettings } from "@/types/settings";

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

/** La configuración guardada en la base (una vez por pedido). Si no se puede leer, la de fábrica. */
export const getMunicipalSettings = cache(async (): Promise<MunicipalSettings> => {
  try {
    const record = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return record?.value ? cleanSettings(JSON.parse(record.value)) : DEFAULT_MUNICIPAL_SETTINGS;
  } catch {
    return DEFAULT_MUNICIPAL_SETTINGS;
  }
});
