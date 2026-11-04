// El formulario del legajo de Recursos Humanos: el horario armado con días y horas, y la lectura de lo que
// manda el formulario (alta y edición). Sin base de datos, para poder probarlo solo.

/** Lunes 0 … domingo 6. */
export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEK_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

export type Schedule = { days: number[]; from: string; to: string };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "08:30" → "8:30", "14:00" → "14". */
function hourText(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return "";
  return m ? `${h}:${String(m).padStart(2, "0")}` : String(h);
}

/** Los días como se dicen: "Lunes a viernes", "Lunes, miércoles y viernes", "Sábado". */
export function daysText(days: number[]): string {
  const d = Array.from(new Set(days)).filter((n) => n >= 0 && n <= 6).sort((a, b) => a - b);
  if (d.length === 0) return "";
  if (d.length === 1) return WEEK_DAYS[d[0]];
  const consecutive = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  if (consecutive && d.length >= 3) return `${WEEK_DAYS[d[0]]} a ${lower(WEEK_DAYS[d[d.length - 1]])}`;
  const names = d.map((n, i) => (i === 0 ? WEEK_DAYS[n] : lower(WEEK_DAYS[n])));
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** "Lunes a viernes, de 8 a 14 h". Vacío si falta algo. */
export function scheduleText(s: Schedule): string {
  const days = daysText(s.days);
  const from = hourText(s.from);
  const to = hourText(s.to);
  if (!days || !from || !to) return "";
  return `${days}, de ${from} a ${to} h`;
}

const DAY_INDEX = new Map(WEEK_DAYS.map((d, i) => [d.toLowerCase(), i]));
const toHHMM = (t: string) => {
  const [h, m = "0"] = t.split(":");
  return `${String(parseInt(h, 10)).padStart(2, "0")}:${String(parseInt(m, 10)).padStart(2, "0")}`;
};

/** Lee un horario guardado con scheduleText. null si es un texto escrito a mano (se edita como texto). */
export function parseSchedule(text: string | null | undefined): Schedule | null {
  const m = String(text ?? "").trim().match(/^(.+), de (\d{1,2}(?::\d{2})?) a (\d{1,2}(?::\d{2})?) h$/);
  if (!m) return null;
  const daysPart = m[1].toLowerCase();
  let days: number[] = [];
  const range = daysPart.match(/^(\S+) a (\S+)$/);
  if (range && DAY_INDEX.has(range[1]) && DAY_INDEX.has(range[2])) {
    const a = DAY_INDEX.get(range[1])!;
    const b = DAY_INDEX.get(range[2])!;
    if (b <= a) return null;
    for (let i = a; i <= b; i++) days.push(i);
  } else {
    const parts = daysPart.split(/, | y /);
    if (!parts.every((p) => DAY_INDEX.has(p))) return null;
    days = parts.map((p) => DAY_INDEX.get(p)!);
  }
  const s = { days, from: toHHMM(m[2]), to: toHHMM(m[3]) };
  return scheduleText(s) === String(text).trim() ? s : null;
}

/** Lo que guarda el legajo en `tasks`: texto solo o JSON con salud, estudios y licencia de conducir. */
export function parseLegajo(tasks: string | null | undefined) {
  const legajo = { tasksText: tasks || "", healthNotes: "", education: "", drivingLicense: "" };
  try {
    if (tasks?.startsWith("{")) {
      const parsed = JSON.parse(tasks);
      legajo.tasksText = parsed.tasksText || "";
      legajo.healthNotes = parsed.healthNotes || "";
      legajo.education = parsed.education || "";
      legajo.drivingLicense = parsed.drivingLicense || "";
    }
  } catch {
    // Texto viejo que no es JSON: queda como funciones del puesto.
  }
  return legajo;
}

export type HRFormData = {
  firstName: string;
  lastName: string;
  dni: string;
  fileNumber: string | null;
  startDate: Date | null;
  position: string;
  areaId: string | null;
  contractType: string;
  category: number | null;
  salary: number;
  schedule: string | null;
  imageUrl: string | null;
  tasks: string;
  status: string;
  statusUntil: Date | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  birthDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
};

const CONTRACTS = ["MENSUALIZADO", "PLANTA_PERMANENTE", "MONOTRIBUTISTA"];
const STATUSES = ["ACTIVO", "LICENCIA", "VACACIONES", "BAJA"];

/**
 * Lo que manda el formulario del legajo, limpio: lo vacío queda en null (el N° de legajo es único, así que
 * un texto vacío chocaba con el de otro agente sin número). Devuelve el error para mostrar si falta algo.
 */
export function readHRForm(get: (key: string) => string | null): { ok: true; data: HRFormData } | { ok: false; error: string } {
  const text = (k: string, max = 200) => {
    const v = (get(k) ?? "").trim().replace(/\s+/g, " ");
    return v ? v.slice(0, max) : null;
  };
  const day = (k: string) => {
    const v = text(k, 10);
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const firstName = text("firstName", 80);
  const lastName = text("lastName", 80);
  const dni = (get("dni") ?? "").replace(/\D/g, "");
  const position = text("position", 120);
  const areaId = text("areaId", 60);
  if (!firstName || !lastName) return { ok: false, error: "Escribí el nombre y el apellido." };
  if (dni.length < 7 || dni.length > 8) return { ok: false, error: "El DNI tiene que tener 7 u 8 números." };
  if (!areaId) return { ok: false, error: "Elegí el área." };
  if (!position) return { ok: false, error: "Escribí el cargo o la función." };

  const email = text("email", 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Revisá el correo: le falta algo." };
  const phone = text("phone", 40);
  if (phone && phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Revisá el teléfono: tiene que tener al menos 8 números." };
  const emergencyContactPhone = text("emergencyContactPhone", 40);
  if (emergencyContactPhone && emergencyContactPhone.replace(/\D/g, "").length < 8) {
    return { ok: false, error: "Revisá el teléfono del contacto de emergencia." };
  }

  const contractType = CONTRACTS.includes(get("contractType") ?? "") ? (get("contractType") as string) : "MENSUALIZADO";
  const status = STATUSES.includes(get("status") ?? "") ? (get("status") as string) : "ACTIVO";
  const category = contractType === "MONOTRIBUTISTA" ? null : parseInt(get("category") ?? "", 10) || null;
  const salary = Math.max(0, parseFloat((get("salary") ?? "").replace(",", ".")) || 0);

  const tasksText = (get("tasks") ?? "").trim();
  const healthNotes = (get("healthNotes") ?? "").trim();
  const education = (get("education") ?? "").trim();
  const drivingLicense = (get("drivingLicense") ?? "").trim();
  const tasks = healthNotes || education || drivingLicense ? JSON.stringify({ tasksText, healthNotes, education, drivingLicense }) : tasksText;

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      dni,
      fileNumber: text("fileNumber", 40),
      startDate: day("startDate"),
      position,
      areaId,
      contractType,
      category,
      salary,
      schedule: text("schedule", 120),
      imageUrl: text("imageUrl", 500),
      tasks,
      status,
      statusUntil: status === "LICENCIA" || status === "VACACIONES" ? day("statusUntil") : null,
      phone,
      email: email ? email.toLowerCase() : null,
      address: text("address", 200),
      birthDate: day("birthDate"),
      emergencyContactName: text("emergencyContactName", 120),
      emergencyContactPhone,
    },
  };
}
