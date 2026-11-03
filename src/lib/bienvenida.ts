// Bienvenida que ve cada persona la primera vez que entra: lo básico de su trabajo, según su rol.
// Sin base de datos, para poder probarlo solo.
import type { Role } from "@prisma/client";
import { canAccessPath, isEmergencySurveyor } from "@/lib/permissions";
import { roleLabel } from "@/lib/roles";

export interface PasoBienvenida {
  titulo: string;
  texto: string;
  /** A dónde lleva el paso (pantalla de la app). */
  href: string;
}

export interface Bienvenida {
  rol: string;
  pasos: PasoBienvenida[];
  /** Lo que sirve en todas las pantallas (buscador y guía). */
  cierre: string | null;
}

const PASOS: Record<Role, PasoBienvenida[]> = {
  SUPERADMIN: [
    { titulo: "Inicio", texto: "Ves toda la gestión. Con «Ver como…» mirás el Inicio de cada rol para probarlo.", href: "/dashboard" },
    { titulo: "Usuarios", texto: "Creás los usuarios y das claves temporales. Solo el Superadmin puede hacerlo.", href: "/admin/users" },
    { titulo: "Configuración", texto: "Los datos de la Municipalidad, el logo y el teléfono de la mesa de ayuda.", href: "/admin/settings" },
    { titulo: "Auditoría", texto: "Quién hizo cada cambio y cuándo.", href: "/admin/audit" },
  ],
  DIRECCION_GENERAL: [
    { titulo: "Inicio", texto: "Cómo está cada área, los expedientes sin movimiento y las derivaciones sin responder.", href: "/dashboard" },
    { titulo: "Sala de Situación", texto: "Lo urgente de toda la Secretaría en una sola pantalla.", href: "/admin/war-room" },
    { titulo: "Expedientes", texto: "Los de todas las áreas, con filtros por estado, prioridad y etiqueta.", href: "/cases" },
    { titulo: "Reportes", texto: "Los números de la gestión, para descargar o imprimir.", href: "/admin/reports" },
  ],
  ADMIN_GENERAL: [
    { titulo: "Órdenes de compra", texto: "Las que esperan tu firma también aparecen en el Inicio.", href: "/admin/purchase-orders" },
    { titulo: "Stock", texto: "Qué hay en el depósito y qué hace falta reponer.", href: "/admin/stock" },
    { titulo: "Vehículos", texto: "Reservas, salidas y los vencimientos de la VTV y el seguro.", href: "/admin/vehicles" },
    { titulo: "Recursos Humanos", texto: "El personal de cada área y quién está de licencia.", href: "/admin/hr" },
  ],
  DIRECTOR_AREA: [
    { titulo: "Carga del equipo", texto: "Cuántos expedientes tiene cada profesional y a quién darle los nuevos.", href: "/cases/equipo" },
    { titulo: "Derivaciones", texto: "Los expedientes que otras áreas le mandan a la tuya: los aceptás o los rechazás.", href: "/cases/derivaciones" },
    { titulo: "Expedientes", texto: "Los de tu área. Con «Sin movimiento» ves los que hace tiempo no tienen intervenciones.", href: "/cases" },
    { titulo: "Programas", texto: "Los programas de tu área, con sus altas y bajas.", href: "/people/programas" },
  ],
  OPERATIVO: [
    { titulo: "Registro Único", texto: "Buscá a la persona por DNI o por nombre antes de cargarla, para no repetirla.", href: "/people" },
    { titulo: "Nuevo expediente", texto: "Abrí el expediente y cargá cada intervención: visita, entrevista o entrega.", href: "/cases/new" },
    { titulo: "Mis tareas", texto: "Tus tareas y seguimientos. Las vencidas se ven en rojo en el Inicio.", href: "/tasks" },
    { titulo: "Barrios", texto: "Lugares de referencia y recorridas de cada barrio.", href: "/barrios" },
  ],
  VIOLENCIA_GENERO: [
    { titulo: "Expedientes reservados", texto: "Los de Violencia de Género solo los ven quienes tienen permiso.", href: "/areas/violence" },
    { titulo: "Registro Único", texto: "Buscá a la persona por DNI o por nombre antes de cargarla, para no repetirla.", href: "/people" },
    { titulo: "Nuevo expediente", texto: "Abrí el expediente y cargá cada intervención.", href: "/cases/new" },
    { titulo: "Mis tareas", texto: "Tus tareas y seguimientos. Las vencidas se ven en rojo en el Inicio.", href: "/tasks" },
  ],
  AUDITOR: [
    { titulo: "Inicio", texto: "Los números de toda la gestión. Podés consultar todo, pero no cargar ni cambiar datos.", href: "/dashboard" },
    { titulo: "Auditoría", texto: "Quién hizo cada cambio y cuándo, con filtros y descarga en Excel.", href: "/admin/audit" },
    { titulo: "Expedientes", texto: "Todos los expedientes, para consultar.", href: "/cases" },
    { titulo: "Reportes", texto: "Los números de la gestión, para descargar o imprimir.", href: "/admin/reports" },
  ],
  RELEVADOR_EMERGENCIA: [
    { titulo: "Cargar una ficha", texto: "En Emergencia climática cargás la ficha de cada familia que relevás.", href: "/admin/emergency" },
    { titulo: "Tus fichas", texto: "Ahí mismo ves las fichas que ya cargaste.", href: "/admin/emergency" },
  ],
};

/** La bienvenida del rol, solo con las pantallas que ese rol puede abrir. */
export function bienvenidaPara(role: Role | string | null | undefined): Bienvenida | null {
  if (!role || !(role in PASOS)) return null;
  const pasos = PASOS[role as Role].filter((p) => canAccessPath(role, p.href.split("?")[0]));
  return {
    rol: roleLabel(role),
    pasos,
    cierre: isEmergencySurveyor(role)
      ? null
      : "Para buscar a alguien o una pantalla, tocá Buscar (o la tecla /). El botón ? de arriba explica la pantalla en la que estés.",
  };
}
