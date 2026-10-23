import { cache } from "react";
import prisma from "@/lib/prisma";
import { DEFAULT_MUNICIPAL_SETTINGS, SETTINGS_KEY, cleanSettings, type MunicipalSettings } from "@/types/settings";

export { SETTINGS_KEY, cleanSettings };

/** La configuración guardada en la base (una vez por pedido). Si no se puede leer, la de fábrica. */
export const getMunicipalSettings = cache(async (): Promise<MunicipalSettings> => {
  try {
    const record = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return record?.value ? cleanSettings(JSON.parse(record.value)) : DEFAULT_MUNICIPAL_SETTINGS;
  } catch {
    return DEFAULT_MUNICIPAL_SETTINGS;
  }
});
