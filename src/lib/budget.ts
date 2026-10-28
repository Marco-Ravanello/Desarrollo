// Cómo mostrar el presupuesto de un área según lo asignado y lo ejecutado. Sin base de datos.

export type BudgetState =
  /** Sin presupuesto cargado y con órdenes aprobadas: falta cargarlo (no es un saldo negativo de verdad). */
  | "FALTA_CARGAR"
  /** Sin presupuesto cargado y sin gastos. */
  | "SIN_PRESUPUESTO"
  /** Se gastó más de lo asignado. */
  | "EXCEDIDO"
  | "OK";

export function budgetState(budget: number, spent: number): BudgetState {
  if (!(budget > 0)) return spent > 0 ? "FALTA_CARGAR" : "SIN_PRESUPUESTO";
  return spent > budget ? "EXCEDIDO" : "OK";
}
