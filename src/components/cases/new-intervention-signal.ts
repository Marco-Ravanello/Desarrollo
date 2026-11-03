// Aviso para abrir el formulario de intervención aunque todavía no esté en pantalla
// (por ejemplo, si se estaba mirando otra pestaña del expediente): lo lee el formulario al aparecer.
import { ABRIR_NUEVA_INTERVENCION } from "@/lib/atajos";

export const pedidoDeIntervencion = { pendiente: false };

export function pedirNuevaIntervencion() {
  pedidoDeIntervencion.pendiente = true;
  window.dispatchEvent(new Event(ABRIR_NUEVA_INTERVENCION));
}
