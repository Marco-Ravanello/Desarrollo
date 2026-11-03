// La frase bajo el saludo del Inicio: lo que la persona tiene para hoy.
// Sin base de datos, para poder probarla sola.
import { formatNumber, plural } from "@/lib/formato";

export interface ResumenDelDiaDatos {
  /** Tareas sin hacer con fecha de hoy o anterior. */
  tareas: number;
  /** De esas, las que ya vencieron (fecha anterior a hoy). */
  vencidas: number;
  /** Expedientes sin movimiento: los propios (a cargo) o los del área o la gestión, según el rol. */
  quietos: number;
  /** Expedientes derivados al área de la persona que esperan que los acepte o los rechace. */
  derivaciones: number;
}

export type ClaveResumen = "tareas" | "quietos" | "derivaciones";

export interface ParteResumen {
  clave: ClaveResumen;
  texto: string;
}

/** Las partes de la frase que tienen algo (en cero no se nombran). */
export function partesDelResumen(d: ResumenDelDiaDatos): ParteResumen[] {
  const partes: ParteResumen[] = [];
  if (d.tareas > 0) {
    let texto = plural(d.tareas, "tarea", "tareas");
    if (d.vencidas > 0) {
      texto +=
        d.vencidas >= d.tareas
          ? d.tareas === 1 ? " vencida" : " vencidas"
          : ` (${formatNumber(d.vencidas)} ${d.vencidas === 1 ? "vencida" : "vencidas"})`;
    }
    partes.push({ clave: "tareas", texto });
  }
  if (d.quietos > 0) {
    partes.push({ clave: "quietos", texto: plural(d.quietos, "expediente sin movimiento", "expedientes sin movimiento") });
  }
  if (d.derivaciones > 0) {
    partes.push({ clave: "derivaciones", texto: plural(d.derivaciones, "derivación por responder", "derivaciones por responder") });
  }
  return partes;
}

/** Lo que va antes de cada parte: nada, ", " o " y " (la última). */
export function separadorAntes(indice: number, total: number): string {
  if (indice === 0) return "";
  return indice === total - 1 ? " y " : ", ";
}

export const RESUMEN_INICIO = "Para hoy tenés ";
export const RESUMEN_VACIO = "Para hoy no tenés tareas, expedientes sin movimiento ni derivaciones por responder.";

/** La frase entera en texto (para probarla y para lectores de pantalla). */
export function fraseDelResumen(d: ResumenDelDiaDatos): string {
  const partes = partesDelResumen(d);
  if (partes.length === 0) return RESUMEN_VACIO;
  return RESUMEN_INICIO + partes.map((p, i) => separadorAntes(i, partes.length) + p.texto).join("") + ".";
}
