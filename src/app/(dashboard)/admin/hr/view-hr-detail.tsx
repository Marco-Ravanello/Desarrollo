import type { ReactNode } from "react";
import { BriefcaseBusiness, CalendarCheck, FileText, HeartPulse, Phone, UserRound, Wallet } from "lucide-react";
import { FormSection } from "@/components/ui/form-section";
import { contractTypeLabel, hrStatusLabel, isAwayStatus } from "@/lib/hr-labels";
import { formatFechaCalendario } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import { parseLegajo } from "@/lib/hr-form";

type Agent = {
  firstName: string;
  lastName: string;
  dni: string;
  fileNumber?: string | null;
  birthDate?: Date | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  area?: { name: string } | null;
  position?: string | null;
  startDate?: Date | null;
  schedule?: string | null;
  contractType?: string | null;
  category?: number | null;
  salary?: number | null;
  status?: string | null;
  statusUntil?: Date | null;
  tasks?: string | null;
};

const EMPTY = <span className="font-normal text-muted-foreground">Sin cargar</span>;
const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

/** Años cumplidos desde una fecha guardada a medianoche UTC (nacimiento, ingreso). */
export function yearsSince(d: Date, now = new Date()): number {
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) years--;
  return Math.max(0, years);
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

const grid = "grid gap-x-6 gap-y-4 sm:grid-cols-2";

/** El legajo para leer: las mismas partes y los mismos nombres que el formulario. */
export function HRRecordView({
  agent,
  leaves,
  leaveKind,
  pendingReturn,
}: {
  agent: Agent;
  leaves?: ReactNode;
  /** El tipo de la licencia que explica la situación de hoy ("Duelo", "Vacaciones"…). */
  leaveKind?: string | null;
  pendingReturn?: boolean;
}) {
  const legajo = parseLegajo(agent.tasks);
  const away = isAwayStatus(agent.status);
  const years = agent.startDate ? yearsSince(agent.startDate) : null;

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <FormSection icon={UserRound} title="Datos personales">
            <dl className={grid}>
              <Item label="Nombre y apellido">{agent.firstName} {agent.lastName}</Item>
              <Item label="DNI"><span className="tabular-nums">{agent.dni}</span></Item>
              <Item label="Fecha de nacimiento">
                {agent.birthDate ? `${formatFechaCalendario(agent.birthDate)} (${yearsSince(agent.birthDate)} años)` : EMPTY}
              </Item>
              <Item label="N° de legajo">{agent.fileNumber || EMPTY}</Item>
            </dl>
          </FormSection>

          <FormSection icon={Phone} title="Datos de contacto">
            <dl className={grid}>
              <Item label="Teléfono">
                {agent.phone ? <a href={tel(agent.phone)} className="text-primary hover:underline">{agent.phone}</a> : EMPTY}
              </Item>
              <Item label="Correo">
                {agent.email ? <a href={`mailto:${agent.email}`} className="text-primary hover:underline">{agent.email}</a> : EMPTY}
              </Item>
              <Item label="Domicilio" wide>{agent.address || EMPTY}</Item>
            </dl>
          </FormSection>

          <FormSection icon={HeartPulse} title="Contacto de emergencia" description="Persona a la que se avisa ante una emergencia.">
            <dl className={grid}>
              <Item label="Nombre y vínculo">{agent.emergencyContactName || EMPTY}</Item>
              <Item label="Teléfono">
                {agent.emergencyContactPhone ? (
                  <a href={tel(agent.emergencyContactPhone)} className="text-primary hover:underline">{agent.emergencyContactPhone}</a>
                ) : (
                  EMPTY
                )}
              </Item>
            </dl>
          </FormSection>
        </div>

        <div className="space-y-5">
          <FormSection icon={BriefcaseBusiness} title="Área de trabajo">
            <dl className={grid}>
              <Item label="Área" wide>{agent.area?.name || EMPTY}</Item>
              <Item label="Cargo o función">{agent.position || EMPTY}</Item>
              <Item label="Fecha de ingreso">
                {agent.startDate ? `${formatFechaCalendario(agent.startDate)}${years ? ` (${years} ${years === 1 ? "año" : "años"})` : ""}` : EMPTY}
              </Item>
              <Item label="Horario" wide>{agent.schedule || EMPTY}</Item>
            </dl>
          </FormSection>

          <FormSection icon={Wallet} title="Contrato y remuneración" description="La remuneración solo la ve quien gestiona Recursos Humanos.">
            <dl className={grid}>
              <Item label="Contrato">{contractTypeLabel(agent.contractType)}</Item>
              {agent.contractType !== "MONOTRIBUTISTA" && <Item label="Categoría">{agent.category ?? EMPTY}</Item>}
              <Item label="Remuneración mensual">
                {agent.salary ? <span className="tabular-nums">{formatPesos(agent.salary)}</span> : EMPTY}
              </Item>
            </dl>
          </FormSection>

          <FormSection icon={CalendarCheck} title="Situación de revista">
            <dl className={grid}>
              <Item label="Situación">{hrStatusLabel(agent.status)}</Item>
              {away && (
                <Item label="Hasta">
                  {agent.statusUntil ? formatFechaCalendario(agent.statusUntil) : EMPTY}
                  {pendingReturn && <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">Falta confirmar la vuelta</span>}
                </Item>
              )}
              {away && leaveKind && <Item label="Tipo de licencia">{leaveKind}</Item>}
            </dl>
          </FormSection>
        </div>
      </div>

      {leaves}

      <FormSection icon={FileText} title="Información adicional">
        <dl className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
          <Item label="Funciones del puesto">{legajo.tasksText || EMPTY}</Item>
          <Item label="Observaciones de salud">{legajo.healthNotes || EMPTY}</Item>
          <Item label="Formación">{legajo.education || EMPTY}</Item>
          <Item label="Licencia de conducir">{legajo.drivingLicense || EMPTY}</Item>
        </dl>
      </FormSection>
    </div>
  );
}
