import { Prisma } from "@prisma/client";
import { ZodError, type ZodIssue } from "zod";

// Nombres legibles de los campos que más aparecen en errores de validación
// o de duplicados. Lo que no está acá se muestra tal cual.
const FIELD_LABELS: Record<string, string> = {
  dni: "DNI",
  cuit: "CUIT",
  cbu: "CBU",
  email: "email",
  plate: "patente",
  name: "nombre",
  firstName: "nombre",
  lastName: "apellido",
  title: "título",
  number: "número",
  orderNumber: "número de orden",
  legajo: "legajo",
  fileNumber: "número de legajo",
  phone: "teléfono",
  address: "domicilio",
  quantity: "cantidad",
  amount: "monto",
  date: "fecha",
  startDate: "fecha de inicio",
  endDate: "fecha de fin",
  areaId: "área",
  personId: "persona",
  vehicleId: "vehículo",
  providerId: "proveedor",
  password: "contraseña",
  role: "rol",
};

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function zodIssueText(issue: ZodIssue) {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null"
        ? "es obligatorio"
        : "tiene un formato incorrecto";
    case "too_small":
      return issue.type === "string" && issue.minimum === 1
        ? "es obligatorio"
        : `es demasiado corto o chico (mínimo ${issue.minimum})`;
    case "too_big":
      return `es demasiado largo o grande (máximo ${issue.maximum})`;
    case "invalid_string":
    case "invalid_date":
    case "invalid_enum_value":
      return "tiene un formato incorrecto";
    default:
      return issue.message;
  }
}

// Los mensajes técnicos (de Prisma, de Node) no le sirven a quien carga datos.
function looksTechnical(message: string) {
  return (
    message.length > 160 ||
    message.includes("\n") ||
    /prisma|invocation|ECONN|ETIMEDOUT|undefined|null|Cannot read|is not a function|Unexpected token/i.test(message)
  );
}

/**
 * Convierte un error atrapado en una server action en un mensaje claro para
 * mostrar en pantalla: "No se pudo guardar porque…". `fallback` describe la
 * operación ("No se pudo guardar el legajo").
 */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.filter((p) => typeof p === "string").pop();
    if (issue && field) return `${fallback}: el campo ${fieldLabel(field)} ${zodIssueText(issue)}.`;
    return `${fallback}: hay datos incompletos o con formato incorrecto.`;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = error.meta?.target;
        const fields = (Array.isArray(target) ? target : typeof target === "string" ? [target] : [])
          .map((f) => fieldLabel(String(f)));
        return fields.length
          ? `${fallback}: ya existe un registro con ese ${fields.join(" y ")}.`
          : `${fallback}: ya existe un registro con esos datos.`;
      }
      case "P2003":
        return `${fallback}: está vinculado a otros datos que no existen o que todavía lo usan.`;
      case "P2025":
        return `${fallback}: el registro ya no existe. Recargá la página y probá de nuevo.`;
      case "P2000":
        return `${fallback}: algún texto es demasiado largo.`;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return `${fallback}: hay datos incompletos o con formato incorrecto.`;
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return `${fallback}: no hay conexión con la base de datos. Probá de nuevo en unos minutos.`;
  }

  if (error instanceof Error && error.message && !looksTechnical(error.message)) {
    const msg = error.message.trim();
    // "No se pudo X: la cantidad…" (en minúscula, salvo siglas como "DNI").
    const reason = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(msg) ? msg[0].toLowerCase() + msg.slice(1) : msg;
    return `${fallback}: ${reason.replace(/\.$/, "")}.`;
  }

  return `${fallback}. Probá de nuevo y, si sigue pasando, avisá al equipo de sistemas.`;
}
