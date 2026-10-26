// Planilla modelo para subir intervenciones (sin base de datos: la arma el navegador).
// Las columnas tienen que coincidir con las que lee importInterventionsAction.

export const IMPORT_COLUMNS = ["DNI", "Nombre", "Apellido", "Area", "Caso", "Descripcion", "Fecha"] as const;

const HELP: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  DNI: "Obligatorio. Solo números, sin puntos.",
  Nombre: "Solo si la persona no está en el Registro Único ni en el padrón.",
  Apellido: "Solo si la persona no está en el Registro Único ni en el padrón.",
  Area: "Obligatorio. Tal como figura en la hoja \"Áreas\".",
  Caso: "Obligatorio. El nombre del expediente; si la persona no tiene uno con ese nombre en el área, se crea.",
  Descripcion: "Obligatorio. Qué se hizo.",
  Fecha: "Obligatorio. Día de la intervención, como dd/mm/aaaa.",
};

export type TemplateSheet = { name: string; rows: string[][]; widths: number[] };

/** Las tres hojas de la planilla: la que se completa (vacía), cómo completarla y las áreas válidas. */
export function buildImportTemplate(areaNames: string[]): TemplateSheet[] {
  return [
    { name: "Intervenciones", rows: [[...IMPORT_COLUMNS]], widths: [12, 18, 18, 36, 30, 50, 12] },
    {
      name: "Cómo completarla",
      rows: [
        ["Columna", "Qué va"],
        ...IMPORT_COLUMNS.map((c) => [c, HELP[c]]),
        [],
        ["", "Completá una fila por intervención en la hoja \"Intervenciones\", sin cambiar los títulos de la primera fila."],
        ["", "Las filas a las que les falta algo no se cargan: la app te dice cuáles y por qué."],
      ],
      widths: [14, 90],
    },
    { name: "Áreas", rows: [["Area"], ...areaNames.map((n) => [n])], widths: [60] },
  ];
}
