// Lectura de planillas (Excel o CSV) para sumar personas al padrón unificado.
// Cada planilla trae encabezados distintos: la app adivina qué columna es cada
// dato y la persona que importa lo puede corregir antes de guardar.
// Sin acceso a la base: se usa en pantalla y en el servidor.

export type PadronField =
  | "dni"
  | "nombreCompleto"
  | "apellido"
  | "nombre"
  | "direccion"
  | "barrio"
  | "localidad"
  | "telefono"
  | "email"
  | "fechaNacimiento"
  | "genero"
  | "rol";

export const PADRON_FIELDS: { key: PadronField; label: string; synonyms: string[] }[] = [
  { key: "dni", label: "DNI", synonyms: ["dni", "documento", "nro documento", "n documento", "numero de documento", "nro de documento", "num documento", "doc", "nro doc", "dni titular", "dni beneficiario", "cuil", "cuit", "cuil cuit"] },
  { key: "nombreCompleto", label: "Nombre y apellido (en una sola columna)", synonyms: ["apellido y nombre", "apellidos y nombres", "nombre y apellido", "nombres y apellidos", "nombre completo", "apellido nombre", "nombre apellido", "beneficiario", "titular", "persona"] },
  { key: "apellido", label: "Apellido", synonyms: ["apellido", "apellidos"] },
  { key: "nombre", label: "Nombre", synonyms: ["nombre", "nombres"] },
  { key: "direccion", label: "Dirección", synonyms: ["direccion", "domicilio", "calle", "dir", "calle y altura", "domicilio real"] },
  { key: "barrio", label: "Barrio", synonyms: ["barrio"] },
  { key: "localidad", label: "Localidad", synonyms: ["localidad", "ciudad"] },
  { key: "telefono", label: "Teléfono", synonyms: ["telefono", "tel", "celular", "cel", "telefono celular", "whatsapp", "contacto", "telefono de contacto"] },
  { key: "email", label: "Email", synonyms: ["email", "e mail", "mail", "correo", "correo electronico"] },
  { key: "fechaNacimiento", label: "Fecha de nacimiento", synonyms: ["fecha de nacimiento", "fecha nacimiento", "nacimiento", "f nac", "fec nac", "fnac", "f de nac", "fecha nac"] },
  { key: "genero", label: "Género", synonyms: ["genero", "sexo"] },
  { key: "rol", label: "Rol en el programa", synonyms: ["rol", "condicion", "vinculo", "parentesco", "tipo de beneficiario", "rol en el programa"] },
];

/** Filas por envío al servidor: las planillas grandes se mandan en tandas. */
export const PADRON_IMPORT_CHUNK = 400;

/** Qué columna de la planilla (por número) corresponde a cada dato. */
export type ColumnMapping = Partial<Record<PadronField, number>>;

export interface PadronImportRecord {
  /** Fila de la planilla, para los mensajes. */
  row: number;
  dni: string;
  nombreCompleto?: string;
  direccion?: string;
  barrio?: string;
  localidad?: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: string;
  genero?: string;
  rol?: string;
}

export interface RowProblem {
  row: number;
  message: string;
}

/** Minúsculas, sin tildes ni signos: "Nº de Documento" → "n de documento", "D.N.I." → "dni". */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    // Siglas con puntos: "d n i" → "dni".
    .replace(/\b([a-z]) (?=[a-z]\b)/g, "$1");
}

/** Adivina qué columna es cada dato: primero por nombre exacto y después por parecido. */
export function guessMapping(headers: unknown[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  const assign = (field: PadronField, index: number) => {
    mapping[field] = index;
    used.add(index);
  };

  for (const field of PADRON_FIELDS) {
    const index = normalized.findIndex((h, i) => !used.has(i) && h !== "" && field.synonyms.includes(h));
    if (index >= 0) assign(field.key, index);
  }
  for (const field of PADRON_FIELDS) {
    if (mapping[field.key] !== undefined) continue;
    const index = normalized.findIndex(
      (h, i) => !used.has(i) && h !== "" && field.synonyms.some((s) => s.length >= 3 && new RegExp(`\\b${s}\\b`).test(h))
    );
    if (index >= 0) assign(field.key, index);
  }
  // Con nombre completo en una columna no hace falta adivinar apellido y nombre por separado.
  if (mapping.nombreCompleto !== undefined && (mapping.apellido === undefined || mapping.nombre === undefined)) {
    delete mapping.apellido;
    delete mapping.nombre;
  }
  return mapping;
}

/** La fila de encabezados: la primera (entre las primeras 15) que nombra el DNI. */
export function findHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 15);
  for (let i = 0; i < limit; i++) {
    if (guessMapping(matrix[i] || []).dni !== undefined) return i;
  }
  const firstFilled = matrix.findIndex((r) => (r || []).filter((c) => String(c ?? "").trim() !== "").length >= 2);
  return Math.max(0, firstFilled);
}

/** Solo números. Un CUIL/CUIT (11 dígitos) se convierte en el DNI que tiene adentro. */
export function normalizeDni(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\.0+$/, "").replace(/\D/g, "");
  if (digits.length === 11) digits = digits.slice(2, 10);
  digits = digits.replace(/^0+/, "");
  return digits.length >= 6 && digits.length <= 8 ? digits : null;
}

function cellText(value: unknown, max = 200): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = (typeof value === "number" ? String(value) : String(value)).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

/** Fecha de planilla (número de Excel, dd/mm/aaaa, aaaa-mm-dd) como dd/mm/aaaa. Si no se entiende, queda el texto. */
export function formatSheetDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (typeof value === "number" && value > 0 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  const text = cellText(value, 40);
  if (!text) return undefined;
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) return `${pad(Number(dmy[1]))}/${pad(Number(dmy[2]))}/${dmy[3]}`;
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return `${pad(Number(ymd[3]))}/${pad(Number(ymd[2]))}/${ymd[1]}`;
  return text;
}

/** "Pérez" + "Juana" → "Pérez, Juana" (el mismo formato que usa "Nueva Persona"). */
export function composeFullName(apellido?: string, nombre?: string): string | undefined {
  if (apellido && nombre) return `${apellido}, ${nombre}`;
  return apellido || nombre || undefined;
}

/**
 * Pasa las filas de la planilla a personas para importar. Las filas vacías se
 * ignoran; las que no tienen un DNI válido se informan como errores; si un DNI
 * se repite, se usa la primera fila y se avisa.
 */
export function buildPadronRecords(
  matrix: unknown[][],
  headerRow: number,
  mapping: ColumnMapping
): { records: PadronImportRecord[]; errors: RowProblem[]; warnings: RowProblem[] } {
  const records: PadronImportRecord[] = [];
  const errors: RowProblem[] = [];
  const warnings: RowProblem[] = [];
  const firstRowByDni = new Map<string, number>();
  const cell = (r: unknown[], field: PadronField) => (mapping[field] === undefined ? undefined : r[mapping[field]!]);

  for (let i = headerRow + 1; i < matrix.length; i++) {
    const r = matrix[i] || [];
    const rowNumber = i + 1;
    if (r.every((c) => String(c ?? "").trim() === "")) continue;

    const rawDni = cell(r, "dni");
    const dni = normalizeDni(rawDni);
    if (!dni) {
      const shown = cellText(rawDni, 30);
      errors.push({ row: rowNumber, message: shown ? `el DNI "${shown}" no es válido` : "falta el DNI" });
      continue;
    }
    const first = firstRowByDni.get(dni);
    if (first !== undefined) {
      warnings.push({ row: rowNumber, message: `el DNI ${dni} se repite (ya está en la fila ${first}); se usa esa fila` });
      continue;
    }
    firstRowByDni.set(dni, rowNumber);

    const email = cellText(cell(r, "email"), 120);
    records.push({
      row: rowNumber,
      dni,
      nombreCompleto: cellText(cell(r, "nombreCompleto")) || composeFullName(cellText(cell(r, "apellido")), cellText(cell(r, "nombre"))),
      direccion: cellText(cell(r, "direccion")),
      barrio: cellText(cell(r, "barrio"), 100),
      localidad: cellText(cell(r, "localidad"), 100),
      telefono: cellText(cell(r, "telefono"), 60),
      email: email && email.includes("@") ? email.toLowerCase() : undefined,
      fechaNacimiento: formatSheetDate(cell(r, "fechaNacimiento")),
      genero: cellText(cell(r, "genero"), 30),
      rol: cellText(cell(r, "rol"), 100),
    });
  }
  return { records, errors, warnings };
}

const TEXT_FIELDS = ["nombreCompleto", "direccion", "barrio", "localidad", "telefono", "email", "fechaNacimiento", "genero", "rol"] as const;

/** Lo que llega del navegador se vuelve a limpiar en el servidor antes de guardar. */
export function sanitizeRecords(input: unknown): PadronImportRecord[] {
  if (!Array.isArray(input)) return [];
  const out: PadronImportRecord[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dni = normalizeDni(r.dni);
    if (!dni) continue;
    const record: PadronImportRecord = { row: Math.max(0, Math.floor(Number(r.row) || 0)), dni };
    for (const field of TEXT_FIELDS) {
      const value = cellText(r[field]);
      if (value) record[field] = value;
    }
    if (record.email && !record.email.includes("@")) delete record.email;
    out.push(record);
  }
  return out;
}
