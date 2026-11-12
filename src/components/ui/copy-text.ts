"use client";

import { toast } from "sonner";

/** Copia un texto (un DNI, un teléfono) y lo avisa. */
export async function copyText(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
  }
}
