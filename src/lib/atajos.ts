// Atajos de teclado de la app y los avisos entre componentes para abrir el buscador, la lista de
// atajos y la guía de la pantalla. Sin base de datos, para poder probarlo solo.

/** Avisos (eventos de la ventana) que escuchan el buscador, la lista de atajos y la guía. */
export const ABRIR_BUSCADOR = "muni:abrir-buscador";
export const ABRIR_ATAJOS = "muni:abrir-atajos";
export const ABRIR_GUIA = "muni:abrir-guia";

export interface Atajo {
  /** Teclas como se muestran, una por recuadro. */
  teclas: string[];
  que: string;
  /** Solo para quien puede cargar expedientes. */
  soloCarga?: boolean;
}

export const ATAJOS: Atajo[] = [
  { teclas: ["/"], que: "Buscar una persona, un expediente o una sección" },
  { teclas: ["Ctrl", "K"], que: "Abrir o cerrar el buscador (en Mac, ⌘ y K)" },
  { teclas: ["N"], que: "Nuevo expediente", soloCarga: true },
  { teclas: ["G"], que: "Abrir la guía de esta pantalla" },
  { teclas: ["?"], que: "Ver esta lista de atajos" },
  { teclas: ["Esc"], que: "Cerrar una ventana o el buscador" },
];

/** Qué hace una tecla suelta, o null si no es un atajo. */
export type AccionAtajo = "buscar" | "nuevo-expediente" | "guia" | "atajos";

export function accionDeTecla(key: string, puedeCargar: boolean): AccionAtajo | null {
  switch (key) {
    case "/":
      return "buscar";
    case "n":
    case "N":
      return puedeCargar ? "nuevo-expediente" : null;
    case "g":
    case "G":
      return "guia";
    case "?":
      return "atajos";
    default:
      return null;
  }
}

/** No se usan atajos mientras se escribe en un campo. */
export function estaEscribiendo(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable === true;
}
