import Link from "next/link";
import type { ReactNode } from "react";
import { Calendar, FolderOpen, Layers, Map as MapIcon, MapPin, MessageCircle, Phone, Plus, Tag } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/formato";
import { whatsappHref, whatsappNumbers } from "@/lib/whatsapp";

/**
 * Encabezado de la ficha de la persona, como una credencial: banda azul institucional con las
 * iniciales, el nombre, el DNI y lo que hoy tiene abierto; abajo, los datos de contacto juntos y
 * los botones más usados.
 */
export interface PersonIdCardProps {
  nombre: string;
  dni: string;
  edad: string | null;
  /** Fecha de nacimiento ya escrita para mostrar. */
  nacimiento: string | null;
  domicilio: string | null;
  telefono: string | null;
  barrio: { label: string; href: string | null } | null;
  programasActivos: number;
  expedientesAbiertos: number;
  etiquetas: string[];
  enPadron: boolean;
  /** Botón "Editar datos" (ya armado, porque es un diálogo con su propio estado). */
  editButton?: ReactNode;
  /** Otros botones de la banda (por ejemplo, "Unir con otra ficha" para la conducción). */
  extraButtons?: ReactNode;
  /** Enlace a "Nuevo expediente" con la persona elegida; null si quien mira no puede cargar. */
  newCaseHref: string | null;
}

/** Botón secundario sobre la banda azul (borde blanco suave). */
export const ON_BAND_BUTTON =
  "h-9 gap-1.5 rounded-xl border-white/30 bg-white/10 text-xs font-bold text-white shadow-none hover:bg-white/20 hover:text-white dark:border-white/30 dark:bg-white/10";

function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "soft" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        tone === "accent" && "bg-muni-orange text-[#0E2A49]",
        tone === "plain" && "bg-white/10 text-white ring-1 ring-inset ring-white/20",
        tone === "soft" && "bg-[#E0EEFF] text-[#163C68]",
      )}
    >
      {children}
    </span>
  );
}

function Dato({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E0EEFF] text-[#163C68] dark:bg-primary/15 dark:text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-medium text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold text-foreground">{children}</p>
      </div>
    </div>
  );
}

/** "11 5004-1004" -> "1150041004" para el enlace de llamada. */
function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
}

export function PersonIdCard({
  nombre,
  dni,
  edad,
  nacimiento,
  domicilio,
  telefono,
  barrio,
  programasActivos,
  expedientesAbiertos,
  etiquetas,
  enPadron,
  editButton,
  extraButtons,
  newCaseHref,
}: PersonIdCardProps) {
  const llamar = telefono ? telHref(telefono) : null;
  // WhatsApp con el número ya pasado a +54 9…: se muestra abajo tal como lo va a usar, para revisarlo.
  const whatsapp = whatsappNumbers(telefono);

  return (
    <section
      aria-label={`Datos principales de ${nombre}`}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-municipal"
    >
      {/* Banda azul, como el encabezado general */}
      <div className="relative border-b-[3px] border-muni-orange bg-gradient-to-r from-[#0E2A49] via-[#163C68] to-[#22507F] px-4 py-5 text-white sm:px-6 dark:from-[#0A1F37] dark:via-[#10304F] dark:to-[#163C68]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <InitialsAvatar
              name={nombre}
              seed={dni}
              size="xl"
              square
              className="h-16 w-16 rounded-2xl text-xl ring-4 ring-white/15 shadow-lg sm:h-20 sm:w-20 sm:text-2xl"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-heading text-xl font-bold leading-tight tracking-tight text-white sm:text-[1.75rem]">{nombre}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill>
                  <span className="text-white/70">DNI</span>
                  <span className="tabular-nums">{dni}</span>
                </Pill>
                {edad && <Pill>{edad}</Pill>}
                {expedientesAbiertos > 0 && (
                  <Pill tone="accent">
                    <FolderOpen className="h-3 w-3" /> {plural(expedientesAbiertos, "expediente abierto")}
                  </Pill>
                )}
                {programasActivos > 0 && (
                  <Pill tone="soft">
                    <Layers className="h-3 w-3" /> {plural(programasActivos, "programa activo")}
                  </Pill>
                )}
                {!enPadron && <Pill>No está en el padrón</Pill>}
              </div>
              {etiquetas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-white/60" aria-hidden />
                  <span className="sr-only">Etiquetas de sus expedientes abiertos:</span>
                  {etiquetas.map((e) => (
                    <span key={e} className="rounded-md bg-white/10 px-2 py-0.5 text-[0.7rem] font-medium text-white/90">
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end print:hidden">
            {llamar && (
              <Button asChild variant="outline" size="sm" className={ON_BAND_BUTTON}>
                <a href={llamar}>
                  <Phone className="h-3.5 w-3.5" /> Llamar
                </a>
              </Button>
            )}
            {whatsapp.length > 0 && (
              <Button asChild variant="outline" size="sm" className={ON_BAND_BUTTON}>
                <a href={whatsappHref(whatsapp[0])} target="_blank" rel="noopener noreferrer" title={`Abrir WhatsApp con ${whatsapp[0].display}`}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </Button>
            )}
            {editButton}
            {extraButtons}
            {newCaseHref && (
              <Button asChild size="sm" className="h-9 gap-1.5 rounded-xl bg-white text-xs font-bold text-[#163C68] hover:bg-[#E0EEFF]">
                <Link href={newCaseHref}>
                  <Plus className="h-4 w-4" /> Nuevo expediente
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Datos de contacto */}
      <div className="px-4 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato icon={MapPin} label="Domicilio">
            {domicilio || "Sin dirección"}
          </Dato>
          <Dato icon={MapIcon} label="Barrio">
            {barrio ? (
              barrio.href ? (
                <Link href={barrio.href} className="text-primary hover:underline" title="Ver la página del barrio">
                  {barrio.label}
                </Link>
              ) : (
                barrio.label
              )
            ) : (
              "Sin dato"
            )}
          </Dato>
          <Dato icon={Phone} label="Teléfono">
            {telefono ? (
              llamar ? (
                <a href={llamar} className="tabular-nums hover:text-primary hover:underline" title="Llamar">
                  {telefono}
                </a>
              ) : (
                telefono
              )
            ) : (
              "Sin teléfono"
            )}
            {whatsapp.map((w) => (
              <a
                key={w.wa}
                href={whatsappHref(w)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline print:hidden"
              >
                <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
                <span>
                  WhatsApp: <span className="whitespace-nowrap tabular-nums">{w.display}</span>
                </span>
              </a>
            ))}
          </Dato>
          <Dato icon={Calendar} label="Nacimiento">
            {nacimiento || "Sin dato"}
          </Dato>
        </div>
      </div>
    </section>
  );
}
