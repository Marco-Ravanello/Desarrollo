/**
 * Novedades de la app, de la más nueva a la más vieja. Después de cada actualización con cambios
 * que se ven, se agrega una entrada arriba: al entrar, cada persona ve una vez la más nueva
 * (components/layout/novedades-aviso.tsx) y todas quedan en /novedades.
 * Textos cortos, en voseo y sin nombres técnicos.
 */
export interface Novedad {
  /** Fecha en formato aaaa-mm-dd; también identifica la entrada. */
  fecha: string;
  titulo: string;
  cambios: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    fecha: "2026-11-02",
    titulo: "Más claro y con los colores de la Municipalidad",
    cambios: [
      "La ficha de cada persona arranca con una credencial azul: nombre, DNI, edad, expedientes abiertos y programas, con los botones Llamar, Editar datos y Nuevo expediente.",
      "La Ficha Social 360° salió del menú: a cada persona la encontrás en el Registro Único o con el buscador de arriba. Cruces de programas está en Registro Único › Programas.",
      "La Sala de Situación tiene \"Pantalla completa\", para verla en una tele o un proyector.",
      "En el Inicio, los números van en azul y el naranja marca solo lo que pide atención.",
      "En las listas largas, los títulos de las columnas quedan a la vista mientras bajás.",
      "La planilla de emergencia muestra los totales arriba, y cada familia se carga en una ficha con campos grandes.",
      "En la pantalla de ingreso está \"¿Te olvidaste la contraseña?\", con a quién pedir una clave temporal.",
      "El encabezado y la barra lateral usan el azul y el naranja de la Municipalidad, y los nombres del padrón se ven con mayúscula inicial.",
    ],
  },
  {
    fecha: "2026-10-30",
    titulo: "Pantallas más prolijas",
    cambios: [
      "Los estados (abierto, en espera, urgente, cerrado…) tienen el mismo color en toda la app.",
      "Las tablas son más aireadas y la fila se marca al pasar el mouse.",
      "Los formularios largos, como Nueva orden de compra, están ordenados en secciones y los datos obligatorios se marcan igual en todos.",
      "Cada sección del menú tiene su color, para ubicarte más rápido.",
    ],
  },
];

/** La entrada más nueva (la que se muestra una vez al entrar). */
export const ULTIMA_NOVEDAD: Novedad | null = NOVEDADES[0] ?? null;

/** "2 de noviembre de 2026" a partir de "2026-11-02". */
export function fechaNovedad(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
