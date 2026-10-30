export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { diaAR } from "@/lib/fechas";
import { plural } from "@/lib/formato";
import { getCurso } from "@/services/cursos";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-layout";
import { Certificado } from "@/components/cursos/certificado";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ inscripto?: string }> };

export const metadata = { title: "Certificados" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaEnLetras = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** Los certificados del curso para imprimir: todos los que corresponden, o el de una persona. */
export default async function CertificadosPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ id }, { inscripto }] = await Promise.all([params, searchParams]);
  const curso = await getCurso(id);
  if (!curso) notFound();

  const conCertificado = curso.inscriptos.filter((i) => i.certificado);
  const lista = inscripto ? conCertificado.filter((i) => i.id === inscripto) : conCertificado;
  const fin = diaAR(curso.terminadoAt) || curso.fechaFin || curso.fechaInicio;
  const datos = {
    nombre: curso.nombre,
    tipo: curso.tipo,
    desde: curso.fechaInicio,
    hasta: curso.fechaFin ?? fin,
    cargaHoraria: curso.cargaHoraria,
    lugar: curso.lugar,
    docente: curso.docente,
    area: curso.area,
    fechaEmision: fechaEnLetras(fin),
  };

  return (
    <div className="space-y-6 print:space-y-0 print:pb-0">
      {/* Cada certificado en su hoja A4 apaisada, sin el membrete ni el pie de las otras impresiones. */}
      <style>{`@media print {
        @page { size: A4 landscape; margin: 10mm; }
        .print-default-header, .print-default-footer { display: none !important; }
        .certificado { break-after: page; }
        .certificado:last-of-type { break-after: auto; }
      }`}</style>
      <PageBreadcrumbs
        items={[
          { label: "Cursos y talleres", href: "/cursos" },
          { label: curso.nombre, href: `/cursos/${id}` },
          { label: "Certificados", active: true },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" asChild className="rounded-xl gap-1.5 font-bold text-xs">
          <Link href={`/cursos/${id}`}><ArrowLeft className="h-4 w-4" /> Volver al curso</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {inscripto && conCertificado.length > 1 && (
            <Button variant="outline" asChild className="rounded-2xl h-11 px-4 font-bold text-xs">
              <Link href={`/cursos/${id}/certificados`}>Ver los {conCertificado.length}</Link>
            </Button>
          )}
          {lista.length > 0 && <PrintButton label={lista.length === 1 ? "Imprimir certificado" : `Imprimir los ${lista.length}`} />}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground print:hidden">
          {curso.estado !== "TERMINADO"
            ? "Los certificados salen cuando el curso se da por terminado."
            : "Nadie llegó a la asistencia mínima para el certificado."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground print:hidden">
            {plural(lista.length, "certificado")}. Al imprimir, elegí la hoja A4 apaisada (horizontal) si no sale sola.
          </p>
          <div className="space-y-6 print:space-y-0">
            {lista.map((i) => (
              <Certificado key={i.id} persona={{ id: i.id, nombre: i.nombre || `DNI ${i.dni}`, dni: i.dni, porcentaje: i.asistencia.porcentaje }} curso={datos} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
