"use client";

import { useState } from "react";
import { BriefcaseBusiness, ChevronDown, HeartPulse, Phone, UserRound, Wallet, CalendarCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, RequiredNote, fieldSelectClass } from "@/components/ui/form-section";
import { SchedulePicker } from "@/components/hr/schedule-picker";
import { parseLegajo } from "@/lib/hr-form";

const dateOnly = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString().split("T")[0] : "");

/**
 * Los campos del legajo, iguales en Nuevo agente y Editar legajo (las dos son páginas, en dos columnas).
 * Sin `agent` arranca vacío; con `agent` muestra sus datos. Lo opcional queda en "Información adicional".
 */
export function HRFormFields({ areas, agent }: { areas: { id: string; name: string }[]; agent?: any }) {
  const legajo = parseLegajo(agent?.tasks);
  const [status, setStatus] = useState<string>(agent?.status || "ACTIVO");
  const [contractType, setContractType] = useState<string>(agent?.contractType || "MENSUALIZADO");
  const hasExtras = Boolean(agent?.imageUrl || legajo.tasksText || legajo.healthNotes || legajo.education || legajo.drivingLicense);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const two = "grid gap-4 sm:grid-cols-2";

  const who = (
    <FormSection icon={UserRound} title="Datos personales">
      <div className={two}>
        <Field label="Nombre" htmlFor="firstName" required>
          <Input id="firstName" name="firstName" defaultValue={agent?.firstName} autoComplete="off" required />
        </Field>
        <Field label="Apellido" htmlFor="lastName" required>
          <Input id="lastName" name="lastName" defaultValue={agent?.lastName} autoComplete="off" required />
        </Field>
        <Field label="DNI" htmlFor="dni" required hint="Sin puntos ni espacios.">
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
        <Field label="N° de legajo" htmlFor="fileNumber" hint="Número asignado por la Municipalidad, si ya lo tiene." className="sm:col-span-2">
          <Input id="fileNumber" name="fileNumber" defaultValue={agent?.fileNumber || ""} />
        </Field>
      </div>
    </FormSection>
  );

  const contact = (
    <FormSection icon={Phone} title="Datos de contacto">
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
      icon={HeartPulse}
      title="Contacto de emergencia"
      description="Persona a la que se avisa ante una emergencia."
    >
      <div className={two}>
        <Field label="Nombre y vínculo" htmlFor="emergencyContactName">
          <Input id="emergencyContactName" name="emergencyContactName" defaultValue={agent?.emergencyContactName || ""} placeholder="Por ejemplo: Ana Gómez, hermana" />
        </Field>
        <Field label="Teléfono" htmlFor="emergencyContactPhone">
          <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" inputMode="tel" defaultValue={agent?.emergencyContactPhone || ""} />
        </Field>
      </div>
    </FormSection>
  );

  const job = (
    <FormSection icon={BriefcaseBusiness} title="Área de trabajo">
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
      icon={Wallet}
      title="Contrato y remuneración"
      description="La remuneración solo la ve quien gestiona Recursos Humanos."
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
        <Field label="Remuneración mensual ($)" htmlFor="salary" className={contractType === "MONOTRIBUTISTA" ? "" : "sm:col-span-2"}>
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
    <FormSection icon={CalendarCheck} title="Situación de revista">
      <div className={two}>
        <Field label="Situación" htmlFor="status" required>
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldSelectClass} required>
            <option value="ACTIVO">Activo</option>
            <option value="LICENCIA">Licencia médica</option>
            <option value="VACACIONES">Vacaciones</option>
            <option value="BAJA">Baja</option>
          </select>
        </Field>
        {(status === "LICENCIA" || status === "VACACIONES") && (
          <Field label="Hasta" htmlFor="statusUntil" hint="Último día de ausencia.">
            <Input id="statusUntil" name="statusUntil" type="date" defaultValue={dateOnly(agent?.statusUntil)} />
          </Field>
        )}
      </div>
    </FormSection>
  );

  const more = (
    <section className="rounded-2xl border border-dashed border-border/80 bg-card/60">
      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
        className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
      >
        <span>
          <span className="block font-heading text-base font-semibold text-foreground">Información adicional</span>
          <span className="block text-xs text-muted-foreground">Foto, funciones del puesto, salud, formación y licencia de conducir. Opcional.</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${moreOpen ? "rotate-180" : ""}`} />
      </button>
      {/* Siempre en la página (oculto si está cerrado), así lo que ya tenía se guarda igual. */}
      <div className={`${moreOpen ? "" : "hidden"} grid gap-4 px-4 pb-5 sm:px-5 lg:grid-cols-2`}>
        <Field label="Funciones del puesto" htmlFor="tasks">
          <Textarea id="tasks" name="tasks" defaultValue={legajo.tasksText} placeholder="Por ejemplo: recorridas en los barrios y atención al público." rows={2} />
        </Field>
        <Field label="Observaciones de salud" htmlFor="healthNotes" hint="Solo lo necesario para el trabajo.">
          <Textarea id="healthNotes" name="healthNotes" defaultValue={legajo.healthNotes} placeholder="Por ejemplo: examen preocupacional aprobado." rows={2} />
        </Field>
        <Field label="Formación" htmlFor="education">
          <Input id="education" name="education" defaultValue={legajo.education} placeholder="Por ejemplo: Trabajo Social, 3.er año" />
        </Field>
        <Field label="Licencia de conducir" htmlFor="drivingLicense" hint="Si está habilitado para conducir vehículos municipales.">
          <Input id="drivingLicense" name="drivingLicense" defaultValue={legajo.drivingLicense} placeholder="Por ejemplo: profesional B2" />
        </Field>
        <Field label="Foto (enlace)" htmlFor="imageUrl" className="lg:col-span-2">
          <Input id="imageUrl" name="imageUrl" type="url" defaultValue={agent?.imageUrl || ""} placeholder="https://…" />
        </Field>
      </div>
    </section>
  );

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
