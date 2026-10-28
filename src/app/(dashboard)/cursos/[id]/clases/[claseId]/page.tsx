export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/auth";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { formatFechaLarga } from "@/lib/fechas";
import { canManageCurso } from "@/lib/cursos";
import { getClase } from "@/services/cursos";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { AsistenciaForm } from "@/components/cursos/asistencia-form";
import { BorrarClaseButton, InscribirForm } from "@/components/cursos/curso-controls";

type Params = { params: Promise<{ id: string; claseId: string }> };

export async function generateMetadata({ params }: Params) {
  const clase = await getClase((await params).claseId).catch(() => null);
  return { title: clase ? `Asistencia del ${clase.fecha.split("-").reverse().join("/")} · ${clase.curso.nombre}` : "Asistencia" };
}

/** La lista de una clase para tomar asistencia, pensada para el celular. */
export default async function ClasePage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, claseId } = await params;
  const clase = await getClase(claseId);
  if (!clase || clase.curso.id !== id) notFound();

  const canManage = canManageCurso(session.user, clase.curso);
  const terminado = clase.curso.estado === "TERMINADO";
  const readOnly = !canManage || terminado;
  // Las fechas de calendario están a medianoche UTC: al mediodía no se corren de día en ninguna zona.
  const fechaLarga = formatFechaLarga(`${clase.fecha}T12:00:00.000Z`);
  const esHoy = clase.fecha === todayInArgentina();

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 animate-in fade-in duration-500">
      <PageBreadcrumbs
        items={[
          { label: "Cursos y talleres", href: "/cursos" },
          { label: clase.curso.nombre, href: `/cursos/${id}` },
          { label: `Asistencia del ${clase.fecha.split("-").reverse().join("/")}`, active: true },
        ]}
      />
      <PageHeader
        title={esHoy ? "Asistencia de hoy" : "Asistencia"}
        description={`${clase.curso.nombre} · ${fechaLarga.charAt(0).toUpperCase()}${fechaLarga.slice(1)}`}
        icon={CalendarCheck}
        actions={canManage && !terminado ? <BorrarClaseButton cursoId={id} claseId={claseId} fecha={clase.fecha.split("-").reverse().join("/")} /> : undefined}
      />

      {terminado && (
        <p className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          El curso está terminado: la asistencia se ve pero no se cambia. Para corregirla, volvé a abrirlo desde{" "}
          <Link href={`/cursos/${id}`} className="font-semibold text-primary hover:underline">la página del curso</Link>.
        </p>
      )}
      {!canManage && !terminado && (
        <p className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          La asistencia la toman la conducción, quien creó el curso y las personas de su área.
        </p>
      )}

      <AsistenciaForm cursoId={id} claseId={claseId} lista={clase.lista} tema={clase.tema} readOnly={readOnly} />

      {canManage && !terminado && (
        <div className="rounded-2xl border border-dashed border-border/70 p-4">
          <InscribirForm cursoId={id} today={clase.fecha} compact />
          <p className="mt-2 text-xs text-muted-foreground">Queda inscripto desde este día y aparece en la lista para marcarlo.</p>
        </div>
      )}
    </div>
  );
}
