// Colores del Mapa Social. Revisados para que se distingan entre sí también con daltonismo;
// además de color, cada capa tiene su propia forma (gota, cuadrado, triángulo).

/** Padrón sin programas elegidos: azul la dirección exacta, ámbar la aproximada (solo barrio). */
export const EXACT_COLOR = "#2563EB";
export const APPROX_COLOR = "#D97706";

/** Un color por programa elegido para comparar (hasta tres), en este orden. */
export const PROGRAM_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

/** Expedientes abiertos: cuadrado frambuesa. */
export const CASE_COLOR = "#c2417a";
/** Fichas de emergencia climática: triángulo gris oscuro. */
export const STORM_COLOR = "#334155";
