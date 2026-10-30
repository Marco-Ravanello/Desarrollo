"use client";

import { useState } from "react";
import { Car, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, RequiredNote, fieldSelectClass } from "@/components/ui/form-section";

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

const dateOnly = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString().split("T")[0] : "");

/**
 * Los campos del legajo, iguales para Nuevo agente y Editar legajo.
 * Sin `agent` arranca vacío; con `agent` muestra sus datos.
 */
export function HRFormFields({ areas, agent }: { areas: { id: string; name: string }[]; agent?: any }) {
  const legajo = parseLegajo(agent?.tasks);
  const [status, setStatus] = useState<string>(agent?.status || "ACTIVO");
  const [contractType, setContractType] = useState<string>(agent?.contractType || "MENSUALIZADO");
  const [hasAcademicStatus, setHasAcademicStatus] = useState(Boolean(legajo.education));
  const [hasDrivingPermit, setHasDrivingPermit] = useState(Boolean(legajo.drivingLicense));

  return (
    <div className="space-y-5">
      <RequiredNote />

      <FormSection variant="plain" title="Datos personales" description="Cómo se llama y con qué documento.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="firstName" required>
            <Input id="firstName" name="firstName" defaultValue={agent?.firstName} placeholder="Nombre" required />
          </Field>
          <Field label="Apellido" htmlFor="lastName" required>
            <Input id="lastName" name="lastName" defaultValue={agent?.lastName} placeholder="Apellido" required />
          </Field>
          <Field label="DNI" htmlFor="dni" required>
            <Input id="dni" name="dni" inputMode="numeric" defaultValue={agent?.dni} placeholder="Sin puntos" required />
          </Field>
          <Field label="N° de legajo o CUIT" htmlFor="fileNumber">
            <Input id="fileNumber" name="fileNumber" defaultValue={agent?.fileNumber || ""} placeholder="Legajo municipal" />
          </Field>
          <Field label="Foto (dirección web)" htmlFor="imageUrl" className="sm:col-span-2">
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={agent?.imageUrl || ""} placeholder="https://…" />
          </Field>
        </div>
      </FormSection>

      <FormSection variant="plain" title="Puesto" description="Dónde trabaja, qué hace y desde cuándo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Área" htmlFor="areaId" required className="sm:col-span-2">
            <select id="areaId" name="areaId" defaultValue={agent?.area?.id || agent?.areaId || ""} required className={fieldSelectClass}>
              <option value="" disabled>
                Elegí el área
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo o función" htmlFor="position" required>
            <Input id="position" name="position" defaultValue={agent?.position} placeholder="Ej: Administrativo" required />
          </Field>
          <Field label="Fecha de ingreso" htmlFor="startDate">
            <Input id="startDate" name="startDate" type="date" defaultValue={dateOnly(agent?.startDate)} />
          </Field>
          <Field label="Horario" htmlFor="schedule" className="sm:col-span-2">
            <Input id="schedule" name="schedule" defaultValue={agent?.schedule || ""} placeholder="Ej: 8 a 14 h" />
          </Field>
        </div>
      </FormSection>

      <FormSection variant="plain" title="Contrato y sueldo" description="El sueldo solo lo ven quienes manejan Recursos Humanos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de contrato" htmlFor="contractType" required>
            <select
              id="contractType"
              name="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className={fieldSelectClass}
              required
            >
              <option value="MENSUALIZADO">Mensualizado</option>
              <option value="PLANTA_PERMANENTE">Planta permanente</option>
              <option value="MONOTRIBUTISTA">Monotributista o contratado</option>
            </select>
          </Field>
          <Field
            label="Categoría"
            htmlFor="category"
            hint={contractType === "MONOTRIBUTISTA" ? "No corresponde a monotributistas." : undefined}
          >
            {contractType === "MONOTRIBUTISTA" ? (
              <Input id="category" disabled placeholder="No corresponde" />
            ) : (
              <Input id="category" name="category" type="number" min="0" defaultValue={agent?.category || ""} placeholder="Ej: 12" />
            )}
          </Field>
          <Field label="Sueldo mensual ($)" htmlFor="salary" className="sm:col-span-2">
            <Input
              id="salary"
              name="salary"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue={agent?.salary || ""}
              placeholder="Ej: 450000"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection variant="plain" title="Situación" description="Si está trabajando, de licencia, de vacaciones o dado de baja.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Situación de hoy" htmlFor="status" required>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldSelectClass}
              required
            >
              <option value="ACTIVO">Activo</option>
              <option value="LICENCIA">Licencia médica</option>
              <option value="VACACIONES">Vacaciones</option>
              <option value="BAJA">Baja</option>
            </select>
          </Field>
          {(status === "LICENCIA" || status === "VACACIONES") && (
            <Field label={status === "VACACIONES" ? "Vacaciones hasta" : "Licencia hasta"} htmlFor="statusUntil">
              <Input id="statusUntil" name="statusUntil" type="date" defaultValue={dateOnly(agent?.statusUntil)} />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection variant="plain" title="Legajo" description="Funciones, salud, estudios y si puede manejar los vehículos.">
        <Field label="Funciones y tareas del puesto" htmlFor="tasks">
          <Textarea
            id="tasks"
            name="tasks"
            defaultValue={legajo.tasksText}
            placeholder="Ej: Relevamientos en los barrios y atención al público."
            rows={2}
          />
        </Field>
        <Field label="Salud y aptitud física" htmlFor="healthNotes">
          <Textarea
            id="healthNotes"
            name="healthNotes"
            defaultValue={legajo.healthNotes}
            placeholder="Ej: Examen preocupacional aprobado."
            rows={2}
          />
        </Field>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <label
            htmlFor="hasAcademicStatus"
            className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground"
          >
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Tiene título o es alumno regular
            </span>
            <input
              type="checkbox"
              id="hasAcademicStatus"
              checked={hasAcademicStatus}
              onChange={(e) => setHasAcademicStatus(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-primary"
            />
          </label>
          {hasAcademicStatus && (
            <Field label="Título, carrera o año que cursa" htmlFor="education">
              <Textarea
                id="education"
                name="education"
                defaultValue={legajo.education}
                placeholder="Ej: Trabajo Social, 3.er año. Secundario completo."
                rows={2}
              />
            </Field>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <label
            htmlFor="hasDrivingPermit"
            className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground"
          >
            <span className="flex items-center gap-2">
              <Car className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Puede manejar los vehículos municipales
            </span>
            <input
              type="checkbox"
              id="hasDrivingPermit"
              checked={hasDrivingPermit}
              onChange={(e) => setHasDrivingPermit(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-primary"
            />
          </label>
          {hasDrivingPermit && (
            <Field label="Licencia de conducir" htmlFor="drivingLicense">
              <Input
                id="drivingLicense"
                name="drivingLicense"
                defaultValue={legajo.drivingLicense}
                placeholder="Ej: Profesional clase B2"
              />
            </Field>
          )}
        </div>
      </FormSection>
    </div>
  );
}
