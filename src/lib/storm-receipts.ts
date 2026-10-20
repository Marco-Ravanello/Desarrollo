// Número que se imprime en la constancia de una entrega de emergencia.
// Sin acceso a la base: se usa en el servidor y en las pruebas.

/** Fecha de la entrega (en hora de Argentina) y el final de su identificador. */
export function receiptNumber(id: string, date: Date): string {
  const day = date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).replace(/-/g, "");
  return `ENT-${day}-${id.slice(-6).toUpperCase()}`;
}
