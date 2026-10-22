/** Dirección para mostrar, sin repetir el barrio cuando ya viene en la calle ("Barrio X - Barrio X"). */
export function personAddress(direccion?: string | null, barrio?: string | null, localidad?: string | null): string {
  const calle = (direccion || "").trim();
  const b = (barrio || "").trim();
  if (!calle) return b ? `Barrio ${b}` : (localidad || "").trim() || "Sin dirección";
  if (!b || calle.toLowerCase().includes(b.toLowerCase())) return calle;
  return `${calle} - Barrio ${b}`;
}
