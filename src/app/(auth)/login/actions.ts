"use server";

import { PASSWORD_HELP_REPLY } from "@/lib/password-help";
import { requestPasswordHelp } from "@/services/password-help";

/**
 * "Pedir clave temporal" en la pantalla de ingreso (idea 106). No hace falta haber entrado.
 * Responde siempre lo mismo, exista o no el usuario, para no mostrar qué cuentas hay.
 */
export async function requestPasswordHelpAction(identifier: unknown): Promise<{ message: string }> {
  try {
    await requestPasswordHelp(identifier);
  } catch (error) {
    console.error("No se pudo registrar el pedido de clave temporal:", error);
  }
  return { message: PASSWORD_HELP_REPLY };
}
