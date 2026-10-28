"use client";

import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";

export type CertificadoData = {
  id: string;
  nombre: string;
  dni: string;
  porcentaje: number | null;
};

export type CertificadoCurso = {
  nombre: string;
  tipo: string;
  desde: string;
  hasta: string;
  cargaHoraria: number | null;
  lugar: string | null;
  docente: string | null;
  area: string | null;
  /** "28 de octubre de 2026": el día en que se dio por terminado. */
  fechaEmision: string;
};

const dia = (iso: string) => iso.split("-").reverse().join("/");
const dniConPuntos = (dni: string) => dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Un certificado en una hoja A4 apaisada, con el escudo y los datos de la Configuración. */
export function Certificado({ persona, curso }: { persona: CertificadoData; curso: CertificadoCurso }) {
  const settings = useMunicipalSettings();
  const verbo = curso.tipo === "TALLER" ? "participó del taller" : "completó el curso";
  const partes = [
    `dictado del ${dia(curso.desde)} al ${dia(curso.hasta)}`,
    curso.lugar ? `en ${curso.lugar}` : null,
    curso.cargaHoraria ? `con una carga horaria de ${curso.cargaHoraria} ${curso.cargaHoraria === 1 ? "hora" : "horas"}` : null,
  ].filter(Boolean);
  const detalle = `${partes.join(", ")}${persona.porcentaje !== null ? `, y una asistencia del ${persona.porcentaje} %` : ""}.`;

  return (
    <article className="certificado relative mx-auto flex aspect-[297/210] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-white p-[4%] text-slate-900 shadow-sm print:aspect-auto print:h-[180mm] print:max-w-none print:rounded-none print:border-0 print:p-[10mm] print:shadow-none">
      <div className="pointer-events-none absolute inset-[2%] rounded-xl border-2 border-[#163C68]/70 print:inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-[3%] rounded-lg border border-[#F69321]/70 print:inset-[3mm]" aria-hidden />

      <header className="relative flex flex-col items-center gap-1 text-center">
        <MunicipalCrest className="h-14 w-14 text-[#163C68] print:h-16 print:w-16" />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-600">{settings.municipalityName}</p>
        <p className="text-xs font-semibold text-slate-700">{settings.secretariatName}</p>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h2 className="font-heading text-3xl font-bold uppercase tracking-[0.3em] text-[#163C68] sm:text-4xl">Certificado</h2>
        <p className="text-sm text-slate-700">Se certifica que</p>
        <p className="text-2xl font-bold uppercase text-slate-900 sm:text-3xl">{persona.nombre}</p>
        <p className="text-sm text-slate-700">DNI {dniConPuntos(persona.dni)}</p>
        <p className="max-w-[80%] text-base leading-relaxed text-slate-800">
          {verbo} <strong>“{curso.nombre}”</strong>, {detalle}
        </p>
      </div>

      <footer className="relative space-y-6">
        <p className="text-center text-xs text-slate-600">
          {settings.municipalityName.replace(/^Municipalidad de /, "")}, {curso.fechaEmision}.
        </p>
        <div className="grid grid-cols-2 gap-16 px-[8%]">
          <div className="text-center">
            <div className="mb-1 border-t border-slate-500" />
            <p className="text-xs font-semibold text-slate-800">{curso.docente || "Docente"}</p>
            <p className="text-[10px] text-slate-500">{curso.docente ? (curso.tipo === "TALLER" ? "Tallerista" : "Docente") : "Firma y aclaración"}</p>
          </div>
          <div className="text-center">
            <div className="mb-1 border-t border-slate-500" />
            <p className="text-xs font-semibold text-slate-800">{curso.area || settings.directionName}</p>
            <p className="text-[10px] text-slate-500">Firma y sello</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
