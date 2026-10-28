export const dynamic = "force-dynamic";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { getPersonById, getRegistroFamilyMembers } from "@/services/people";
import { getFichaSocialByDniFromDb } from "@/services/ficha-social-db";
import { getFichaHistorial } from "@/services/ficha-historial";
import { getPersonVisits } from "@/services/recorridas";
import { getGrupoFamiliar } from "@/services/grupo-familiar";
import { getAddressOptions, getPersonDataChanges, getPersonEditData } from "@/services/person-data";
import { cleanDni } from "@/services/ficha-social";
import { Card } from "@/components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonTabs, TabShortcut } from "@/components/people/person-tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Phone, MapPin, ShieldAlert, Mail, History, Eye, FileIcon, ExternalLink, Users,
  Contact, Layers, FolderOpen, CheckCircle2, UserPlus, PencilLine, User, Footprints,
} from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAreas } from "@/services/cases";
import { CreateCaseForm } from "./create-case-form";
import { UploadDocumentForm } from "./upload-document-form";
import { CloseCaseButton } from "./close-case-button";
import { AddFamilyMemberForm } from "./add-family-member-form";
import { EditPersonDialog } from "./edit-person-dialog";
import { RemoveFamilyMemberButton } from "./remove-family-member-button";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { RememberVisit } from "@/components/search/remember-visit";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { ProgramasDetalle } from "@/components/people/programas-detalle";
import { ProgramEnrollmentPanel } from "@/components/people/program-enrollment";
import { getProgramEnrollment, getProgramHistory } from "@/services/program-enrollment";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { GrupoFamiliarLinks } from "@/components/people/grupo-familiar-links";
import { FichaHistorialView } from "@/components/people/ficha-historial";
import { plural } from "@/lib/formato";
import { getCaseStatusConfig } from "@/lib/status-styles";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { canEditSocialRecords, canManageProgramEnrollment, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatFecha, formatFechaHora } from "@/lib/fechas";
import { barrioLabel } from "@/lib/person-display";
import { barrioSlug, matchBarrio } from "@/lib/barrios";
import { personTitle } from "@/lib/page-titles";

export const generateMetadata = personTitle;

const TABS = ["datos", "programas", "expedientes", "familia", "historia", "documentos"] as const;
type Tab = (typeof TABS)[number];

const fecha = formatFecha;
const fechaHora = formatFechaHora;

function Dato({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{children}</p>
      </div>
    </div>
  );
}

/**
 * La ficha de una persona: todo lo que hay de ella en un solo lugar (datos, programas,
 * expedientes, familia, historia y documentos). Reemplaza al legajo y a la Ficha 360° separados.
 */
export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userRole = session?.user?.role;
  const canEdit = canEditSocialRecords(userRole);
  const canViewSensitive = hasPermission(userRole as any, PERMISSIONS.VIEW_SENSITIVE_CASES);

  const [{ id: rawId }, { tab }] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(rawId);
  const person: any = await getPersonById(id);
  const dni = person?.dni || cleanDni(id);
  if (!dni) notFound();

  const [ficha, historial, grupo, registroFamily, areas, cambiosDatos, editData, addressOptions, enrollment, programHistory, visitas] = await Promise.all([
    getFichaSocialByDniFromDb(dni),
    getFichaHistorial(dni, { canViewSensitive }),
    getGrupoFamiliar(dni, { canViewSensitive }),
    getRegistroFamilyMembers(dni),
    person && canEdit ? getAreas() : Promise.resolve([]),
    getPersonDataChanges(dni),
    person && canEdit ? getPersonEditData(dni) : Promise.resolve(null),
    person && canEdit ? getAddressOptions() : Promise.resolve(null),
    getProgramEnrollment(dni, { role: userRole, areaId: session?.user?.areaId }),
    getProgramHistory(dni),
    getPersonVisits(dni),
  ]);
  const canManagePrograms = canManageProgramEnrollment(userRole) && (Boolean(person) || enrollment.inPadron);

  // Sin legajo ni padrón, pero con fichas de emergencia: se muestra lo que hay.
  if (!person && historial.fichasTormenta.length === 0) notFound();

  const nombre = person ? `${person.lastName}, ${person.firstName}`.replace(/^,\s*|,\s*$/g, "") : historial.nombre || `DNI ${dni}`;
  const enPadron = ficha.encontrado;

  const allowedCases: any[] = (person?.cases || []).filter((c: any) => canViewSensitive || !isSensitiveArea(c.area?.name));
  const allowedCaseIds = new Set(allowedCases.map((c) => c.id));
  const activeCases = allowedCases.filter((c) => c.status !== "CERRADO");
  const closedCases = allowedCases.filter((c) => c.status === "CERRADO");
  const documents: any[] = (person?.documents || []).filter((d: any) => !d.caseId || allowedCaseIds.has(d.caseId));

  const programas: string[] = ficha.programas_activos || person?.programasActivos || [];
  // Con la persona en el padrón cuenta lo mismo que muestra "Programas en los que está hoy".
  const totalProgramas = enrollment.inPadron
    ? enrollment.active.length
    : Object.keys(ficha.detalle_programas || {}).length || programas.length;
  const historiaCount = historial.intervencionesTotal + historial.fichasTormenta.length + cambiosDatos.length + visitas.length;
  const familiaCount = grupo.declarados.length + grupo.mismoDomicilio.length;
  const activeTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "datos";

  const edad = person?.birthDate
    ? `${fecha(person.birthDate)}`
    : person?.fechaNacimientoTexto
      ? person.fechaNacimientoTexto
      : person?.edadAprox && person.edadAprox !== "No registrada"
      ? `${person.edadAprox} años (aprox.)`
      : "Sin dato";

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Registro Único", href: "/people" }, { label: nombre, active: true }]} />
      {person && <RememberVisit kind="person" id={person.id} />}

      <div className="space-y-3">
        <PageHeader
          title={nombre}
          leading={<InitialsAvatar name={nombre} seed={dni} size="lg" square />}
          actions={editData && addressOptions ? <EditPersonDialog person={editData} options={addressOptions} /> : undefined}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline" className="border-border text-foreground font-mono font-bold">DNI {dni}</Badge>
          {person?.barrio && (
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs font-bold">
              {matchBarrio(person.barrio) ? (
                <Link href={`/barrios/${barrioSlug(matchBarrio(person.barrio)!)}`} className="hover:underline" title="Ver la página del barrio">
                  {barrioLabel(person.barrio)}
                </Link>
              ) : (
                barrioLabel(person.barrio)
              )}
            </Badge>
          )}
          {totalProgramas > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs">
              {plural(totalProgramas, "programa activo")}
            </Badge>
          )}
          {activeCases.length > 0 && (
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-bold text-xs">
              {plural(activeCases.length, "expediente abierto")}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border border-border/60 shadow-xs bg-card text-card-foreground rounded-2xl overflow-hidden">
        <PersonTabs defaultTab={activeTab}>
          <div className="px-4 pt-4 overflow-x-auto">
            <TabsList className="bg-muted/40 p-1 border border-border/40 rounded-2xl">
              <TabsTrigger value="datos" className="rounded-xl text-xs font-bold gap-1.5"><Contact className="h-3.5 w-3.5" />Datos</TabsTrigger>
              <TabsTrigger value="programas" className="rounded-xl text-xs font-bold gap-1.5"><Layers className="h-3.5 w-3.5" />Programas ({totalProgramas})</TabsTrigger>
              <TabsTrigger value="expedientes" className="rounded-xl text-xs font-bold gap-1.5"><FolderOpen className="h-3.5 w-3.5" />Expedientes ({allowedCases.length})</TabsTrigger>
              <TabsTrigger value="familia" className="rounded-xl text-xs font-bold gap-1.5"><Users className="h-3.5 w-3.5" />Familia ({familiaCount})</TabsTrigger>
              <TabsTrigger value="historia" className="rounded-xl text-xs font-bold gap-1.5"><History className="h-3.5 w-3.5" />Historia ({historiaCount})</TabsTrigger>
              <TabsTrigger value="documentos" className="rounded-xl text-xs font-bold gap-1.5"><FileIcon className="h-3.5 w-3.5" />Documentos ({documents.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="datos" className="p-4 sm:p-6 space-y-6">
            {!enPadron && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                No figura en el padrón de programas sociales.{" "}
                {person ? "Sus datos son los cargados en el Registro Único." : "Solo hay fichas de emergencia con su DNI."}
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground">Contacto</h3>
                <Dato icon={MapPin} label="Domicilio">
                  {person?.address || "Sin dirección"}
                  {person?.localidad && !String(person.address || "").includes(person.localidad) ? ` · ${person.localidad}` : ""}
                </Dato>
                <Dato icon={Phone} label="Teléfono">{person?.phone || "Sin teléfono"}</Dato>
                {person?.email && <Dato icon={Mail} label="Correo">{person.email}</Dato>}
                <Dato icon={Calendar} label={person?.birthDate || person?.fechaNacimientoTexto ? "Fecha de nacimiento" : "Edad"}>{edad}</Dato>
                {person?.gender && person.gender !== "No especificado" && <Dato icon={User} label="Género">{person.gender}</Dato>}
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground">Programas sociales</h3>
                {programas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cobra ningún programa del padrón.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {programas.map((p) => (
                      <Badge key={p} className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold py-1 px-3 rounded-xl">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}
                {person?.roles && enPadron && <p className="text-xs text-muted-foreground">Rol en los programas: {person.roles}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground">Atención municipal</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TabShortcut value={activeCases.length} label={activeCases.length === 1 ? "expediente abierto" : "expedientes abiertos"} tab="expedientes" />
                <TabShortcut value={historial.intervencionesTotal} label={historial.intervencionesTotal === 1 ? "intervención" : "intervenciones"} tab="historia" />
                <TabShortcut value={historial.fichasTormenta.length} label={historial.fichasTormenta.length === 1 ? "ficha de emergencia" : "fichas de emergencia"} tab="historia" />
                <TabShortcut value={familiaCount} label={familiaCount === 1 ? "familiar o conviviente" : "familiares y convivientes"} tab="familia" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="programas" className="p-4 sm:p-6">
            <div className="space-y-6">
              <ProgramEnrollmentPanel
                dni={dni}
                active={enrollment.active}
                available={enrollment.available}
                history={programHistory}
                canManage={canManagePrograms}
                today={todayInArgentina()}
              />
              <ProgramasDetalle detalle={ficha.detalle_programas} nombreTitular={ficha.nombre_detectado} />
            </div>
          </TabsContent>

          <TabsContent value="expedientes" className="p-4 sm:p-6 space-y-6">
            {allowedCases.length === 0 ? (
              <EmptyMessage compact title="No tiene expedientes" icon={FolderOpen} className="rounded-2xl border border-dashed border-border/60" />
            ) : (
              <div className="space-y-3">
                {[...activeCases, ...closedCases].map((c) => {
                  const estado = getCaseStatusConfig(c.status);
                  const sensible = isSensitiveArea(c.area?.name);
                  return (
                    <div key={c.id} className={`p-4 border border-border/60 rounded-2xl flex flex-wrap justify-between items-center gap-3 bg-muted/20 ${c.status === "CERRADO" ? "opacity-80" : "hover:border-primary/50"} transition-all`}>
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${sensible ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                          {sensible ? <ShieldAlert className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/cases/${c.id}`} className="font-bold text-foreground leading-snug hover:underline">{c.title}</Link>
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.area?.name} · abierto el {fecha(c.createdAt)}
                            {c.status === "CERRADO" ? ` · cerrado el ${fecha(c.updatedAt)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${estado.badgeClass}`}>{estado.label}</Badge>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/cases/${c.id}`} aria-label="Ver expediente"><Eye className="h-4 w-4 text-muted-foreground" /></Link>
                        </Button>
                        {c.status !== "CERRADO" && canEdit && <CloseCaseButton caseId={c.id} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {person && canEdit && <CreateCaseForm personId={person.id} areas={areas} />}
          </TabsContent>

          <TabsContent value="familia" className="p-4 sm:p-6 space-y-6">
            <GrupoFamiliarLinks grupo={grupo} />
            {person && canEdit && (
              <div className="space-y-3 border-t border-border/40 pt-6">
                <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Grupo familiar cargado en el Registro Único
                </h3>
                {registroFamily.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {registroFamily.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-3 border border-border/60 rounded-2xl bg-muted/20 min-w-0">
                        <Link href={`/people/${m.dni}`} className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{m.lastName}, {m.firstName}</p>
                          <p className="text-xs text-muted-foreground font-mono">DNI {m.dni}</p>
                        </Link>
                        <RemoveFamilyMemberButton id={m.id} name={`${m.firstName} ${m.lastName}`.trim()} />
                      </div>
                    ))}
                  </div>
                )}
                <AddFamilyMemberForm personId={person.id} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="historia" className="p-4 sm:p-6">
            {/* Si lo único que hay son visitas de recorridas, no se muestra el "todavía no tiene atención". */}
            {(visitas.length === 0 || historial.intervencionesTotal + historial.fichasTormenta.length > 0) && (
              <FichaHistorialView historial={historial} withCases={false} />
            )}
            {visitas.length > 0 && (
              <section className={`space-y-3 ${historial.intervencionesTotal + historial.fichasTormenta.length > 0 ? "mt-8" : ""}`}>
                <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <Footprints className="h-4 w-4 text-primary" /> Visitas en recorridas ({visitas.length})
                </h3>
                <ol className="relative space-y-4 border-l border-border/60 pl-5">
                  {visitas.map((v) => (
                    <li key={v.id} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-xs font-bold text-muted-foreground">
                        {fechaHora(v.fecha)}{v.visitadaPor ? ` · ${v.visitadaPor}` : ""}
                      </p>
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{v.resultadoLabel}</span>
                        {" en la "}
                        <Link href={`/barrios/recorridas/${v.recorridaId}`} className="text-primary hover:underline">recorrida por {v.barrio}</Link>
                      </p>
                      {v.nota && <p className="whitespace-pre-line text-sm text-muted-foreground">{v.nota}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {cambiosDatos.length > 0 && (
              <section className="space-y-3 mt-8">
                <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <PencilLine className="h-4 w-4 text-primary" /> Cambios de datos ({cambiosDatos.length})
                </h3>
                <ol className="relative space-y-4 border-l border-border/60 pl-5">
                  {cambiosDatos.map((c) => (
                    <li key={c.id} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-background" />
                      <p className="text-xs font-bold text-muted-foreground">
                        {fechaHora(c.fecha)}{c.usuario ? ` · ${c.usuario}` : ""}
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {c.cambios.map((linea, idx) => (
                          <li key={idx} className="text-xs text-foreground break-words">{linea}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="p-4 sm:p-6 space-y-6">
            {documents.length === 0 ? (
              <EmptyMessage compact title="Todavía no tiene documentos" icon={FileIcon} className="rounded-2xl border border-dashed border-border/60" />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {documents.map((d) => {
                  const href = d.url.startsWith("/api") ? d.url : `/api${d.url}`;
                  return (
                    <div key={d.id} className="p-3 border border-border/60 rounded-2xl flex justify-between items-center gap-2 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{fecha(d.createdAt)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {person && canEdit && <UploadDocumentForm personId={person.id} />}
          </TabsContent>
        </PersonTabs>
      </Card>
    </div>
  );
}
