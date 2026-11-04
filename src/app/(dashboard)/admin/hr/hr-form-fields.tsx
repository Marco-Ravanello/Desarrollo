"use client";

import { useState } from "react";
import { BriefcaseBusiness, ChevronDown, HeartPulse, Phone, UserRound, Wallet, CalendarCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, RequiredNote, fieldSelectClass } from "@/components/ui/form-section";
import { SchedulePicker } from "@/components/hr/schedule-picker";

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
 * Los campos del legajo, iguales para Nuevo agente (página, en dos columnas) y Editar legajo (panel lateral).
 * Sin `agent` arranca vacío; con `agent` muestra sus datos. Lo que no hace falta siempre queda en "Agregar más datos".
 */
export function HRFormFields({
  areas,
  agent,
  layout = "sheet",
}: {
  areas: { id: string; name: string }[];
  agent?: any;
  layout?: "page" | "sheet";
}) {
  const legajo = parseLegajo(agent?.tasks);
  const [status, setStatus] = useState<string>(agent?.status || "ACTIVO");
  const [contractType, setContractType] = useState<string>(agent?.contractType || "MENSUALIZADO");
  const hasExtras = Boolean(agent?.imageUrl || legajo.tasksText || legajo.healthNotes || legajo.education || legajo.drivingLicense);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const variant = layout === "page" ? "card" : "plain";
  const two = "grid gap-4 sm:grid-cols-2";

  const who = (
    <FormSection variant={variant} icon={layout === "page" ? UserRound : undefined} title="Quién es">
      <div className={two}>
        <Field label="Nombre" htmlFor="firstName" required>
          <Input id="firstName" name="firstName" defaultValue={agent?.firstName} autoComplete="off" required />
        </Field>
        <Field label="Apellido" htmlFor="lastName" required>
          <Input id="lastName" name="lastName" defaultValue={agent?.lastName} autoComplete="off" required />
        </Field>
        <Field label="DNI" htmlFor="dni" required hint="Solo los números, sin puntos.">
          <Input
            id="dni"
            name="dni"
            inputMode="numeric"
            pattern="[0-9.\s]{7,10}"
            title="7 u 8 números"
            defaultValue={agent?.dni}
            required
          />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="birthDate">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={dateOnly(agent?.birthDate)} />
        </Field>
        <Field label="N° de legajo" htmlFor="fileNumber" hint="El número que le da la Municipalidad, si ya lo tiene." className="sm:col-span-2">
          <Input id="fileNumber" name="fileNumber" defaultValue={agent?.fileNumber || ""} />
        </Field>
      </div>
    </FormSection>
  );

  const contact = (
    <FormSection variant={variant} icon={layout === "page" ? Phone : undefined} title="Cómo ubicarlo">
      <div className={two}>
        <Field label="Teléfono" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={agent?.phone || ""} placeholder="Por ejemplo: 11 5555 1234" />
        </Field>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={agent?.email || ""} placeholder="nombre@ejemplo.com" />
        </Field>
        <Field label="Domicilio" htmlFor="address" className="sm:col-span-2">
          <Input id="address" name="address" defaultValue={agent?.address || ""} placeholder="Calle, número y localidad" />
        </Field>
      </div>
    </FormSection>
  );

  const emergency = (
    <FormSection
      variant={variant}
      icon={layout === "page" ? HeartPulse : undefined}
      title="A quién avisar si le pasa algo"
      description="Una persona de confianza para llamar en una emergencia."
    >
      <div className={two}>
        <Field label="Nombre y relación" htmlFor="emergencyContactName">
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={agent?.emergencyContactName || ""} placeholder="Por ejemplo: Ana Gómez, hermana" />
        </Field>
        <Field label="Teléfono" htmlFor="emergencyContactPhone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" inputMode="tel" defaultValue={agent?.emergencyContactPhone || ""} />
        </Field>
      </div>
    </FormSection>
  );

  const job = (
    <FormSection variant={variant} icon={layout === "page" ? BriefcaseBusiness : undefined} title="Dónde trabaja">
      <div className={two}>
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
          <Input id="position" name="position" defaultValue={agent?.position} placeholder="Por ejemplo: administrativa" required />
        </Field>
        <Field label="Fecha de ingreso" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={dateOnly(agent?.startDate)} />
        </Field>
        <Field label="Horario" className="sm:col-span-2">
          <SchedulePicker defaultValue={agent?.schedule} />
        </Field>
      </div>
    </FormSection>
  );

  const contract = (
    <FormSection
      variant={variant}
      icon={layout === "page" ? Wallet : undefined}
      title="Contrato y sueldo"
      description="El sueldo lo ve solo quien maneja Recursos Humanos."
    >
      <div className={two}>
        <Field label="Contrato" htmlFor="contractType" required>
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
        {contractType !== "MONOTRIBUTISTA" && (
          <Field label="Categoría" htmlFor="category">
            <Input id="category" name="category" type="number" min="0" inputMode="numeric" defaultValue={agent?.category || ""} placeholder="Por ejemplo: 12" />
          </Field>
        )}
        <Field label="Sueldo por mes ($)" htmlFor="salary" className={contractType === "MONOTRIBUTISTA" ? "" : "sm:col-span-2"}>
          <Input
            id="salary"
            name="salary"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={agent?.salary || ""}
            placeholder="Por ejemplo: 450000"
          />
        </Field>
      </div>
    </FormSection>
  );

  const today = (
    <FormSection variant={variant} icon={layout === "page" ? CalendarCheck : undefined} title="Cómo está hoy">
      <div className={two}>
        <Field label="Situación" htmlFor="status" required>
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldSelectClass} required>
            <option value="ACTIVO">Trabajando</option>
            <option value="LICENCIA">De licencia médica</option>
            <option value="VACACIONES">De vacaciones</option>
            <option value="BAJA">De baja</option>
          </select>
        </Field>
        {(status === "LICENCIA" || status === "VACACIONES") && (
          <Field label="Hasta" htmlFor="statusUntil" hint="El último día que no viene.">
            <Input id="statusUntil" name="statusUntil" type="date" defaultValue={dateOnly(agent?.statusUntil)} />
          </Field>
        )}
      </div>
    </FormSection>
  );

  const more = (
    <section className={layout === "page" ? "rounded-2xl border border-dashed border-border/80 bg-card/60" : "border-t border-border/60 pt-4"}>
      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
        className={`flex w-full items-center justify-between gap-3 text-left ${layout === "page" ? "p-4 sm:p-5" : ""}`}
      >
        <span>
          <span className="block font-heading text-base font-semibold text-foreground">Agregar más datos</span>
          <span className="block text-xs text-muted-foreground">Foto, tareas, salud, estudios y licencia de conducir. Todo opcional.</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${moreOpen ? "rotate-180" : ""}`} />
      </button>
      {/* Siempre en la página (oculto si está cerrado), así lo que ya tenía se guarda igual. */}
      <div className={`${moreOpen ? "" : "hidden"} grid gap-4 ${layout === "page" ? "px-4 pb-5 sm:px-5 lg:grid-cols-2" : "pt-4"}`}>
        <Field label="Qué tareas hace" htmlFor="tasks">
          <Textarea id="tasks" name="tasks" defaultValue={legajo.tasksText} placeholder="Por ejemplo: recorridas en los barrios y atención al público." rows={2} />
        </Field>
        <Field label="Salud" htmlFor="healthNotes" hint="Solo lo necesario para cuidarlo en el trabajo.">
          <Textarea id="healthNotes" name="healthNotes" defaultValue={legajo.healthNotes} placeholder="Por ejemplo: examen preocupacional aprobado." rows={2} />
        </Field>
        <Field label="Estudios" htmlFor="education">
          <Input id="education" name="education" defaultValue={legajo.education} placeholder="Por ejemplo: Trabajo Social, 3.er año" />
        </Field>
        <Field label="Licencia de conducir" htmlFor="drivingLicense" hint="Si puede manejar los vehículos municipales.">
          <Input id="drivingLicense" name="drivingLicense" defaultValue={legajo.drivingLicense} placeholder="Por ejemplo: profesional B2" />
        </Field>
        <Field label="Foto (dirección web)" htmlFor="imageUrl" className="lg:col-span-2">
          <Input id="imageUrl" name="imageUrl" type="url" defaultValue={agent?.imageUrl || ""} placeholder="https://…" />
        </Field>
      </div>
    </section>
  );

  if (layout === "page") {
    return (
      <div className="space-y-5">
        <RequiredNote />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            {who}
            {contact}
            {emergency}
          </div>
          <div className="space-y-5">
            {job}
            {contract}
            {today}
          </div>
        </div>
        {more}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RequiredNote />
      {who}
      {job}
      {contract}
      {today}
      {contact}
      {emergency}
      {more}
    </div>
  );
}
