/** Expedientes del área de Violencia de Género: solo los ve quien tiene permiso (la misma regla que el listado de expedientes). */
export const isSensitiveArea = (areaName?: string | null) => Boolean(areaName && /violencia/i.test(areaName));
