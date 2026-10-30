export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award, CalendarDays, GraduationCap, Users } from "lucide-react";
import { auth } from "@/auth";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { formatNumber, plural } from "@/lib/formato";
import { formatFechaCalendario } from "@/lib/fechas";
import {
  CURSO_ESTADOS, canChooseCursoArea, canDeleteCurso, canManageCurso, cursoTipoLabel, motivoSinCertificado, periodoTexto, type CursoEstado,
} from "@/lib/cursos";
import { getCurso, getCursoFormOptions } from "@/services/cursos";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { PrintButton } from "@/components/ui/print-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CursoDialog, DeleteCursoButton, InscribirForm, InscriptoActions, TerminarCursoButton, TomarAsistenciaButton,
} from "@/components/cursos/curso-controls";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const curso = await getCurso((await params).id).catch(() => null);
  return { title: curso ? `${curso.nombre} · Cursos y talleres` : "Curso" };
}

const dia = (iso: string) => iso.split("-").reverse().join("/");

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || <span className="text-muted-foreground">Sin cargar</span>}</dd>
    </div>
  );
}

/** Columnas en blanco de la planilla para imprimir y tomar asistencia en papel. */
const PLANILLA_COLUMNAS = 10;

/** Un curso o taller: sus datos, los inscriptos con su asistencia, las clases y los certificados. */
export default async function CursoPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = session.user;
  const curso = await getCurso((await params).id);
  if (!curso) notFound();

  const canManage = canManageCurso(user, curso);
  const terminado = curso.estado === "TERMINADO";
  const today = todayInArgentina();
  const options = canManage ? await getCursoFormOptions(user) : null;
  const activos = curso.inscriptos.filter((i) => i.estado === "INSCRIPTO");
  const dejaron = curso.inscriptos.length - activos.length;
  const conCertificado = curso.inscriptos.filter((i) => i.certificado).length;
  // Antes de terminar: cuántos llegan hoy a la asistencia mínima (lo que pasaría si terminara ahora).
  const lleganHoy = activos.filter((i) =>
    curso.asistenciaMinima <= 0 ? true : i.asistencia.porcentaje !== null && i.asistencia.porcentaje >= curso.asistenciaMinima
  ).length;
  const tipo = cursoTipoLabel(curso.tipo).toLowerCase();

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Cursos y talleres", href: "/cursos" }, { label: curso.nombre, active: true }]} />

      {/* Para imprimir: la planilla de asistencia en papel. El membrete lo pone el marco de la app. */}
      <div className="hidden text-slate-900 print:block">
        <h1 className="text-lg font-bold uppercase tracking-tight">Asistencia · {curso.nombre}</h1>
        <p className="text-xs text-slate-600">
          {periodoTexto(curso.fechaInicio, curso.fechaFin)}
          {curso.horario ? ` · ${curso.horario}` : ""}
          {curso.lugar ? ` · ${curso.lugar}` : ""}
          {curso.docente ? ` · Docente: ${curso.docente}` : ""}
        </p>
        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-slate-400 px-1 py-1 text-left">Nombre</th>
              <th className="border border-slate-400 px-1 py-1 text-left">DNI</th>
              {Array.from({ length: PLANILLA_COLUMNAS }, (_, i) => (
                <th key={i} className="w-10 border border-slate-400 px-1 py-1 text-[9px] font-normal text-slate-500">__/__</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activos.map((i) => (
              <tr key={i.id} className="break-inside-avoid">
                <td className="border border-slate-400 px-1 py-1.5">{i.nombre || "Sin nombre"}</td>
                <td className="border border-slate-400 px-1 py-1.5">{i.dni}</td>
                {Array.from({ length: PLANILLA_COLUMNAS }, (_, k) => (
                  <td key={k} className="border border-slate-400" />
                ))}
              </tr>
            ))}
            {Array.from({ length: 5 }, (_, k) => (
              <tr key={`vacia-${k}`}>
                <td className="border border-slate-400 px-1 py-2.5" />
                <td className="border border-slate-400" />
                {Array.from({ length: PLANILLA_COLUMNAS }, (_, j) => (
                  <td key={j} className="border border-slate-400" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-slate-600">P: presente · A: ausente · CA: con aviso. Después se pasa a la app con “Otro día”.</p>
      </div>

      <div className="space-y-6 print:hidden">
        <PageHeader
          title={curso.nombre}
          description={[
            cursoTipoLabel(curso.tipo),
            curso.area ?? "Sin área",
            curso.programaLabel ? `Las inscripciones quedan de alta en ${curso.programaLabel}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          icon={GraduationCap}
          badge={
            <Badge
              variant="outline"
              className={terminado ? "border-border bg-muted text-muted-foreground" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}
            >
              {CURSO_ESTADOS[curso.estado as CursoEstado] ?? curso.estado}
            </Badge>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {terminado && conCertificado > 0 && (
                <Button asChild className="rounded-2xl h-11 px-5 font-bold text-xs gap-2">
                  <Link href={`/cursos/${curso.id}/certificados`}><Award className="h-4 w-4" /> Certificados ({conCertificado})</Link>
                </Button>
              )}
              {!terminado && activos.length > 0 && <PrintButton label="Planilla en papel" />}
              {canManage && options && (
                <CursoDialog
                  curso={curso}
                  areas={options.areas}
                  programas={options.programas}
                  canChooseArea={canChooseCursoArea(user.role)}
                  defaultAreaId={curso.areaId}
                  today={today}
                />
              )}
              {canManage && (
                <TerminarCursoButton
                  id={curso.id}
                  terminado={terminado}
                  conCertificado={lleganHoy}
                  inscriptos={activos.length}
                  asistenciaMinima={curso.asistenciaMinima}
                />
              )}
              {canDeleteCurso(user, curso) && curso.clases.length === 0 && <DeleteCursoButton id={curso.id} nombre={curso.nombre} />}
              <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
                <Link href="/cursos" aria-label="Volver a Cursos y talleres"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
            </div>
          }
        />

        <Card className="shadow-none">
          <CardContent className="pt-6">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Dato label="Cuándo" value={periodoTexto(curso.fechaInicio, curso.fechaFin)} />
              <Dato label="Días y horario" value={curso.horario} />
              <Dato label="Lugar" value={curso.lugar} />
              <Dato label="Docente" value={curso.docente} />
              <Dato label="Carga horaria" value={curso.cargaHoraria ? plural(curso.cargaHoraria, "hora") : null} />
              <Dato label="Para el certificado" value={curso.asistenciaMinima > 0 ? `${curso.asistenciaMinima} % de asistencia` : "Sin mínimo de asistencia"} />
            </dl>
            {curso.descripcion && <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{curso.descripcion}</p>}
            {curso.creador && <p className="mt-4 text-xs text-muted-foreground">Lo cargó {curso.creador}.</p>}
          </CardContent>
        </Card>

        <StatRow>
          <StatCard label="Inscriptos" value={formatNumber(activos.length)} icon={Users} tone="blue" hint={dejaron ? `${plural(dejaron, "persona dejó", "personas dejaron")}` : undefined} />
          <StatCard label="Clases" value={formatNumber(curso.clases.length)} icon={CalendarDays} tone="purple" hint={curso.clases[0] ? `Última: ${dia(curso.clases[0].fecha)}` : "Todavía no se tomó asistencia"} />
          <StatCard label="Asistencia" value={curso.asistenciaTotal === null ? "—" : `${curso.asistenciaTotal} %`} tone="green" hint="De todo el curso" />
          <StatCard
            label={terminado ? "Con certificado" : `Llegan al ${curso.asistenciaMinima} %`}
            value={formatNumber(terminado ? conCertificado : lleganHoy)}
            icon={Award}
            tone="orange"
            hint={terminado ? `De ${plural(activos.length, "inscripto")}` : "Con la asistencia de hoy"}
          />
        </StatRow>

        {canManage && !terminado && (
          <Card className="border-primary/30 bg-primary/5 shadow-none">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Asistencia</p>
                <p className="text-sm text-muted-foreground">Abrí la lista en el celular y marcá a cada persona. Si se tomó en papel, elegí “Otro día”.</p>
              </div>
              <TomarAsistenciaButton cursoId={curso.id} today={today} />
            </CardContent>
          </Card>
        )}

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Inscriptos</CardTitle>
            <CardDescription>
              {curso.programaLabel
                ? `Al inscribir a alguien queda de alta en ${curso.programaLabel} (si ya estaba, no cambia nada).`
                : "Personas del padrón o del Registro Único."}
              {terminado && " El certificado sale para quien sigue inscripto y llegó a la asistencia mínima."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage && !terminado && <InscribirForm cursoId={curso.id} today={today} />}
            {curso.inscriptos.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">Todavía no hay inscriptos.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead className="text-right">Asistencia</TableHead>
                        <TableHead>Certificado</TableHead>
                        {canManage && <TableHead className="w-24" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {curso.inscriptos.map((i) => {
                        const sin = motivoSinCertificado(curso, i, i.asistencia);
                        return (
                          <TableRow key={i.id} className={i.estado === "DEJO" ? "opacity-60" : undefined}>
                            <TableCell>
                              <Link href={`/people/${i.dni}`} className="font-semibold text-foreground hover:text-primary hover:underline">{i.nombre || "Sin nombre"}</Link>
                              <p className="text-xs text-muted-foreground">
                                DNI {i.dni}
                                {i.estado === "DEJO" && ` · Dejó${i.bajaFecha ? ` el ${dia(i.bajaFecha)}` : ""}${i.bajaMotivo ? `: ${i.bajaMotivo}` : ""}`}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">{i.telefono || <span className="text-muted-foreground">Sin teléfono</span>}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{dia(i.fecha)}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold tabular-nums">{i.asistencia.porcentaje === null ? "—" : `${i.asistencia.porcentaje} %`}</span>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {i.asistencia.presentes} P · {i.asistencia.ausentes} A{i.asistencia.avisos ? ` · ${i.asistencia.avisos} CA` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {i.certificado ? (
                                <Link href={`/cursos/${curso.id}/certificados?inscripto=${i.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                                  <Award className="h-4 w-4" /> Imprimir
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">{sin}</span>
                              )}
                            </TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                {!terminado && (
                                  <InscriptoActions cursoId={curso.id} inscriptoId={i.id} nombre={i.nombre || `DNI ${i.dni}`} dejo={i.estado === "DEJO"} programa={curso.programaLabel} />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 md:hidden">
                  {curso.inscriptos.map((i) => {
                    const sin = motivoSinCertificado(curso, i, i.asistencia);
                    return (
                      <li key={i.id} className={`flex items-start justify-between gap-3 px-3 py-3 ${i.estado === "DEJO" ? "opacity-60" : ""}`}>
                        <div className="min-w-0">
                          <Link href={`/people/${i.dni}`} className="block truncate text-sm font-semibold text-foreground">{i.nombre || "Sin nombre"}</Link>
                          <p className="text-xs text-muted-foreground">
                            DNI {i.dni} · {i.asistencia.porcentaje === null ? "sin clases" : `asistencia ${i.asistencia.porcentaje} %`}
                            {i.estado === "DEJO" && " · dejó"}
                          </p>
                          {i.certificado ? (
                            <Link href={`/cursos/${curso.id}/certificados?inscripto=${i.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              <Award className="h-3.5 w-3.5" /> Imprimir certificado
                            </Link>
                          ) : (
                            terminado && <p className="mt-0.5 text-xs text-muted-foreground">{sin}</p>
                          )}
                        </div>
                        {canManage && !terminado && (
                          <InscriptoActions cursoId={curso.id} inscriptoId={i.id} nombre={i.nombre || `DNI ${i.dni}`} dejo={i.estado === "DEJO"} programa={curso.programaLabel} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Clases</CardTitle>
            <CardDescription>Cada día en que se tomó asistencia. Tocá una para ver o corregir la lista.</CardDescription>
          </CardHeader>
          <CardContent>
            {curso.clases.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">Todavía no se tomó asistencia.</p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
                {curso.clases.map((c) => (
                  <li key={c.id}>
                    <Link href={`/cursos/${curso.id}/clases/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{formatFechaCalendario(`${c.fecha}T00:00:00.000Z`)}</p>
                        {c.tema && <p className="truncate text-xs text-muted-foreground">{c.tema}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">{plural(c.presentes, "presente")}</span> · {plural(c.ausentes, "ausente")}{c.avisos ? ` · ${c.avisos} con aviso` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {terminado && <p className="mt-3 text-xs text-muted-foreground">El {tipo} está terminado: para cambiar la asistencia, volvé a abrirlo.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

