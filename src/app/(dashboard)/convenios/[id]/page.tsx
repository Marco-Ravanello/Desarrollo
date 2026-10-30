export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  Landmark,
  Lock,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { canAccessPath, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { AGREEMENT_STATUS_LABELS, isAgreementClosed } from "@/lib/convenios";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { formatFechaHora, formatFechaLarga } from "@/lib/fechas";
import { formatNumber, formatPercent, formatPesos, plural } from "@/lib/formato";
import {
  DEFAULT_ALERT_PERCENTS,
  LUGARES,
  NIVELES,
  canClosePeriod,
  canConfigureCost,
  canLoadHours,
  canReopenPeriod,
  canViewCostDetail,
  diasDelPeriodo,
  horasTexto,
  listaDeDias,
  moverPeriodo,
  parseDia,
  periodoDe,
  periodoTexto,
  type Periodo,
} from "@/lib/convenio-gasto";
import {
  getConvenioControl,
  getCuidadoras,
  getDia,
  getNnyaRecientes,
  getResumenPeriodo,
  getValoresHora,
  periodoPedido,
} from "@/services/convenio-gasto";
import { getPeriodosCerrados, type PeriodoCerrado } from "@/services/convenio-cierre";
import { getNnyaDelConvenio } from "@/services/convenio-nnya";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GastoChart } from "@/components/convenios/gasto-chart";
import {
  BorrarValorButton,
  ConfigurarControlForm,
  CuidadoraActions,
  DiaPicker,
  FilaActions,
  NuevaCuidadoraForm,
  NuevasHorasForm,
  RepetirDiaButton,
  ValorHoraForm,
} from "@/components/convenios/gasto-controls";
import {
  CerrarPeriodoButton,
  EgresoButton,
  ExpedienteSelect,
  ReabrirPeriodoButton,
  ReingresoButton,
} from "@/components/convenios/cierre-nnya-controls";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string; periodo?: string; dia?: string }>;
};

export async function generateMetadata({ params }: Params) {
  const convenio = await getConvenioControl((await params).id).catch(() => null);
  return {
    title: convenio ? `Control del gasto · ${convenio.title}` : "Control del gasto",
  };
}

const TABS = [
  { key: "tablero", label: "Tablero", icon: Gauge },
  { key: "carga", label: "Carga diaria", icon: CalendarDays },
  { key: "nnya", label: "NNyA", icon: Baby },
  { key: "cuidadoras", label: "Cuidadoras", icon: Users },
  { key: "ajustes", label: "Valor hora y tope", icon: Settings },
] as const;
type Tab = (typeof TABS)[number]["key"];

const dma = (iso: string) => iso.split("-").reverse().join("/");

const NIVEL_CLASS: Record<string, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-200",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
};

function Tabs({ id, active, periodo }: { id: string; active: Tab; periodo: string }) {
  return (
    <nav aria-label="Secciones del control del gasto" className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex min-w-max gap-1 rounded-2xl border border-border/40 bg-muted/40 p-1">
        {TABS.map((t) => {
          const on = t.key === active;
          const qs = new URLSearchParams();
          if (t.key !== "tablero") qs.set("ver", t.key);
          if (t.key === "tablero" || t.key === "cuidadoras") qs.set("periodo", periodo);
          return (
            <li key={t.key}>
              <Link
                href={`/convenios/${id}${qs.size ? `?${qs}` : ""}`}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PeriodoNav({ id, ver, periodo, startDay, today }: { id: string; ver: Tab; periodo: Periodo; startDay: number; today: string }) {
  const prev = moverPeriodo(periodo, -1, startDay);
  const next = moverPeriodo(periodo, 1, startDay);
  const href = (p: Periodo) => `/convenios/${id}?${new URLSearchParams({ ...(ver !== "tablero" ? { ver } : {}), periodo: p.desde })}`;
  const actual = periodoDe(today, startDay).desde === periodo.desde;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href(prev)}
        className="inline-flex h-9 items-center gap-1 rounded-xl border border-border/60 px-3 text-xs font-semibold hover:bg-muted/50"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
      </Link>
      <p className="text-sm font-bold text-foreground">
        Período del {periodoTexto(periodo)}
        {actual && <span className="ml-1.5 font-semibold text-muted-foreground">(el actual)</span>}
      </p>
      {next.desde <= today && (
        <Link
          href={href(next)}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-border/60 px-3 text-xs font-semibold hover:bg-muted/50"
        >
          Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Control del gasto de un convenio por horas: tablero del período, carga diaria, cuidadoras y ajustes. */
export default async function ControlGastoPage({ params, searchParams }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = session.user;
  const { id } = await params;
  const sp = await searchParams;
  const convenio = await getConvenioControl(id);
  if (!convenio) notFound();

  const canSeeAgreements = canAccessPath(user.role, "/admin/agreements");
  const crumbs = [
    ...(canSeeAgreements
      ? [
          { label: "Convenios", href: "/admin/agreements" },
          { label: convenio.title, href: `/admin/agreements/${convenio.id}` },
        ]
      : [{ label: convenio.title }]),
    { label: "Control del gasto", active: true },
  ];
  const header = (
    <PageHeader title={convenio.title} description={`Control del gasto · ${convenio.area?.name ?? "Sin área"}`} icon={Landmark} />
  );

  if (!canViewCostDetail(user, convenio)) {
    return (
      <div className="space-y-6">
        <PageBreadcrumbs items={crumbs} />
        {header}
        <EmptyMessage
          icon={Landmark}
          title="Este control lo ven la conducción, Auditoría y el área del convenio"
          description="Tiene datos de las personas acompañadas. Si lo necesitás, pedíselo a la conducción."
        />
      </div>
    );
  }

  const today = todayInArgentina();
  const canConfig = canConfigureCost(user.role);
  // canLoad: la gente que trabaja el convenio (también maneja los NNyA); canLoadHours: además, que el convenio siga.
  const canLoad = canLoadHours(user, convenio);
  const convenioTerminado = isAgreementClosed(convenio.status);

  if (convenio.costMode !== "POR_HORA") {
    return (
      <div className="space-y-6">
        <PageBreadcrumbs items={crumbs} />
        {header}
        {canConfig ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Controlar el gasto por horas</CardTitle>
              <CardDescription>
                Para convenios que se pagan por hora, como el de cuidadoras: se cargan las horas de cada día y la app calcula lo gastado, lo
                que queda del tope y si se va a pasar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigurarControlForm agreementId={convenio.id} inicial={null} today={today} />
            </CardContent>
          </Card>
        ) : (
          <EmptyMessage
            icon={Clock}
            title="Este convenio todavía no tiene control por horas"
            description="Lo configura la conducción: el valor de la hora, el tope y cuándo empieza cada período."
          />
        )}
      </div>
    );
  }

  const ver: Tab = TABS.some((t) => t.key === sp.ver) ? (sp.ver as Tab) : "tablero";
  const startDay = convenio.periodStartDay ?? 1;
  const periodo = periodoPedido(convenio, sp.periodo, today);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={crumbs} />
      {header}
      <Tabs id={convenio.id} active={ver} periodo={periodo.desde} />
      {convenioTerminado && (
        <p className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            El convenio está {AGREEMENT_STATUS_LABELS[convenio.status].toLowerCase()}: ya no se cargan ni se cambian horas. Se puede ver
            todo, cerrar los períodos y bajar las rendiciones.
          </span>
        </p>
      )}
      {ver === "tablero" && <Tablero convenio={convenio} periodo={periodo} startDay={startDay} today={today} user={user} />}
      {ver === "carga" && (
        <Carga
          convenio={convenio}
          dia={parseDia(sp.dia) ?? today}
          today={today}
          canLoad={canLoad && !convenioTerminado}
          canConfig={canConfig}
        />
      )}
      {ver === "nnya" && <Nnyas convenio={convenio} today={today} canLoad={canLoad} user={user} />}
      {ver === "cuidadoras" && (
        <Cuidadoras convenio={convenio} periodo={periodo} startDay={startDay} today={today} canLoad={canLoad && !convenioTerminado} />
      )}
      {ver === "ajustes" && <Ajustes convenio={convenio} today={today} canConfig={canConfig} />}
    </div>
  );
}

type Convenio = NonNullable<Awaited<ReturnType<typeof getConvenioControl>>>;

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

type SessionUser = { id?: string; role?: string | null; areaId?: string | null };

async function Tablero({
  convenio,
  periodo,
  startDay,
  today,
  user,
}: {
  convenio: Convenio;
  periodo: Periodo;
  startDay: number;
  today: string;
  user: SessionUser;
}) {
  const [r, cerrados, nnyas] = await Promise.all([
    getResumenPeriodo(convenio, periodo, today),
    getPeriodosCerrados(convenio.id),
    getNnyaDelConvenio(user, convenio.id),
  ]);
  const cierre = cerrados.find((c) => c.desde === periodo.desde) ?? null;
  const egresoDe = new Map(nnyas.map((n) => [n.dni, n.egreso]));
  const nivel = r.nivel ? NIVELES[r.nivel] : null;
  const terminado = today > periodo.hasta;
  const sinHoras = r.porDia.length === 0;

  // Las horas por día que se proyectan: sin los NNyA que ya egresaron.
  const sinEgresados = r.ultimoDia !== null && r.horasBase !== null && r.horasBase < r.ultimoDia.horas;
  const base = `${horasTexto(r.horasBase ?? 0)} por día${sinEgresados ? ", sin los NNyA que egresaron" : ""}`;

  let mensaje: string;
  if (sinHoras) mensaje = "Todavía no hay horas cargadas en este período.";
  else if (terminado) {
    mensaje =
      r.disponible !== null && r.disponible < 0
        ? `El período cerró pasado del tope en ${formatPesos(-r.disponible)}.`
        : `El período cerró con ${formatPercent(r.porcentaje)} del tope gastado.`;
  } else if (r.excedente > 0) {
    mensaje = `Si sigue como el último día cargado (${base}), el período cierra en ${formatPesos(r.proyeccion)}: se pasa del tope en ${formatPesos(r.excedente)}.`;
  } else if (r.proyeccion !== null) {
    mensaje = `Si sigue como el último día cargado (${base}), el período cierra en ${formatPesos(r.proyeccion)}, dentro del tope.`;
  } else {
    mensaje = "Falta el valor hora para calcular la proyección.";
  }
  const alertTone = r.excedente > 0 || (r.disponible !== null && r.disponible < 0) ? "rose" : (nivel?.tone ?? "green");

  return (
    <div className="space-y-6">
      <PeriodoNav id={convenio.id} ver="tablero" periodo={periodo} startDay={startDay} today={today} />

      <div role="status" className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${NIVEL_CLASS[alertTone]}`}>
        {alertTone === "rose" || alertTone === "orange" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>{mensaje}</span>
      </div>

      <StatRow>
        <StatCard
          label="Tope del período"
          value={formatPesos(r.tope)}
          icon={Wallet}
          tone="blue"
          hint={`${plural(diasDelPeriodo(periodo), "día")}, del ${periodoTexto(periodo)}`}
        />
        <StatCard
          label="Gastado"
          value={formatPesos(r.gastado)}
          icon={Clock}
          tone={nivel?.tone === "rose" ? "red" : nivel?.tone === "green" ? "green" : "orange"}
          hint={
            <span className="inline-flex items-center gap-1.5">
              {r.porcentaje !== null && `${formatPercent(r.porcentaje)} del tope`}
              {nivel && (
                <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${NIVEL_CLASS[nivel.tone]}`}>
                  {nivel.label}
                </Badge>
              )}
            </span>
          }
        />
        <StatCard
          label="Disponible"
          value={r.disponible === null ? "—" : formatPesos(r.disponible)}
          icon={Wallet}
          tone={r.disponible !== null && r.disponible < 0 ? "red" : "green"}
          hint={`${horasTexto(r.horas)} cargadas`}
        />
        <StatCard
          label={terminado ? "Cierre del período" : "Proyección al cierre"}
          value={r.proyeccion === null ? "—" : formatPesos(r.proyeccion)}
          icon={TrendingUp}
          tone={r.excedente > 0 ? "red" : "purple"}
          hint={
            terminado
              ? "Período terminado"
              : r.ultimoDia
                ? `Con ${horasTexto(r.horasBase ?? 0)} por día, ${plural(r.diasRestantes, "día")} más`
                : "Sin horas cargadas"
          }
        />
      </StatRow>

      {(r.diasSinHoras.length > 0 || r.horasSinValor > 0) && (
        <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {r.diasSinHoras.length > 0 && (
            <p>
              <span className="font-semibold">
                {r.diasSinHoras.length === 1 ? "Un día sin horas cargadas" : `${r.diasSinHoras.length} días sin horas cargadas`}:
              </span>{" "}
              {listaDeDias(r.diasSinHoras)}. Si hubo acompañamiento, el gasto real es mayor.{" "}
              <Link href={`/convenios/${convenio.id}?ver=carga&dia=${r.diasSinHoras[0]}`} className="font-semibold underline">
                Cargar el {dma(r.diasSinHoras[0]).slice(0, 5)}
              </Link>
            </p>
          )}
          {r.horasSinValor > 0 && (
            <p>
              <span className="font-semibold">{horasTexto(r.horasSinValor)} en días sin valor hora:</span> no se cuentan en pesos. Cargá el
              valor en “Valor hora y tope”.
            </p>
          )}
        </div>
      )}

      <CierreDelPeriodo convenio={convenio} periodo={periodo} today={today} cierre={cierre} user={user} hayHoras={!sinHoras} />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Gasto acumulado del período</CardTitle>
          <CardDescription>
            Lo gastado día por día contra el tope
            {r.proyeccion !== null && !terminado ? ", y hacia dónde va si sigue igual" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sinHoras ? (
            <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              Cuando se carguen horas, acá se ve cómo avanza el gasto.
            </p>
          ) : (
            <GastoChart
              desde={periodo.desde}
              hasta={periodo.hasta}
              porDia={r.porDia}
              tope={r.tope}
              proyeccion={terminado ? null : r.proyeccion}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Por NNyA</CardTitle>
            <CardDescription>Horas y gasto de cada NNyA acompañado en el período.</CardDescription>
          </CardHeader>
          <CardContent>
            {r.porNnya.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin horas en este período.</p>
            ) : (
              <Table mobileCards={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>NNyA</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Días</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.porNnya.map((n) => (
                    <TableRow key={n.dni}>
                      <TableCell>
                        <Link href={`/people/${n.dni}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                          {n.nombre || "Sin nombre"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          DNI {n.dni}
                          {egresoDe.get(n.dni) ? ` · egresó el ${dma(egresoDe.get(n.dni)!).slice(0, 5)}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(n.dias)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{horasTexto(n.horas)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatPesos(n.importe)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Por cuidadora</CardTitle>
            <CardDescription>Para controlar lo que factura cada una en el período.</CardDescription>
          </CardHeader>
          <CardContent>
            {r.porCuidadora.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin horas en este período.</p>
            ) : (
              <CuidadorasTotales filas={r.porCuidadora} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Si el período está cerrado, quién lo cerró; si terminó, el botón para cerrarlo; y la rendición en Excel. */
function CierreDelPeriodo({
  convenio,
  periodo,
  today,
  cierre,
  user,
  hayHoras,
}: {
  convenio: Convenio;
  periodo: Periodo;
  today: string;
  cierre: PeriodoCerrado | null;
  user: SessionUser;
  hayHoras: boolean;
}) {
  const terminado = today > periodo.hasta;
  const texto = periodoTexto(periodo);
  const canExport = hasPermission(user.role as never, PERMISSIONS.EXPORT_PERSONAL_DATA);
  if (!cierre && !terminado && !hayHoras) return null;
  const rendicion = canExport && (hayHoras || cierre) && (
    <Button variant="outline" className="gap-2" asChild>
      <a href={`/api/convenios/${convenio.id}/rendicion?periodo=${periodo.desde}`}>
        <Download className="h-4 w-4" /> {cierre || terminado ? "Bajar la rendición (Excel)" : "Bajar la rendición parcial (Excel)"}
      </a>
    </Button>
  );
  let texto1: React.ReactNode;
  if (cierre) {
    texto1 = (
      <>
        <span className="font-semibold">Período cerrado</span> el {formatFechaHora(cierre.cerradoAt)}
        {cierre.cerradoPor ? ` por ${cierre.cerradoPor}` : ""}: {horasTexto(cierre.horas)}, {formatPesos(cierre.gastado)}. Sus horas ya no
        se cambian.
      </>
    );
  } else if (terminado) {
    texto1 = canClosePeriod(user, convenio) ? (
      <>
        <span className="font-semibold">El período terminó.</span> Cuando estén todas las horas, cerralo: quedan fijos los totales para la
        rendición.
      </>
    ) : (
      <>
        <span className="font-semibold">El período terminó y todavía no se cerró.</span> Lo cierran la conducción y la dirección del área.
      </>
    );
  } else {
    texto1 = <>El período sigue abierto: la rendición sale parcial, con lo cargado hasta hoy.</>;
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${cierre ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} aria-hidden />
        <span>{texto1}</span>
      </p>
      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
        {rendicion}
        {!cierre && terminado && canClosePeriod(user, convenio) && (
          <CerrarPeriodoButton agreementId={convenio.id} desde={periodo.desde} texto={texto} />
        )}
        {cierre && canReopenPeriod(user.role) && <ReabrirPeriodoButton agreementId={convenio.id} desde={periodo.desde} texto={texto} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NNyA
// ---------------------------------------------------------------------------

async function Nnyas({ convenio, today, canLoad, user }: { convenio: Convenio; today: string; canLoad: boolean; user: SessionUser }) {
  const nnyas = await getNnyaDelConvenio(user, convenio.id);
  const activos = nnyas.filter((n) => !n.egreso).length;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">NNyA del convenio</CardTitle>
        <CardDescription>
          {nnyas.length === 0
            ? "Aparecen solos al cargar sus primeras horas."
            : `${plural(activos, "activo")} y ${plural(nnyas.length - activos, "con egreso", "con egreso")}. El ingreso es su primer día con horas. Los que egresaron no cuentan para la proyección.`}
        </CardDescription>
      </CardHeader>
      {nnyas.length > 0 && (
        <CardContent>
          <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
            {nnyas.map((n) => {
              const nombre = n.nombre || `DNI ${n.dni}`;
              return (
                <li
                  key={n.id}
                  className={`grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_9.5rem] md:items-center ${n.egreso ? "bg-muted/30" : ""}`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/people/${n.dni}`}
                      className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {nombre}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      DNI {n.dni} · {horasTexto(n.horas)} en total
                    </p>
                  </div>
                  <div className="text-sm">
                    <p>
                      <span className="text-muted-foreground">Ingreso:</span> {dma(n.ingreso)}
                    </p>
                    {n.egreso ? (
                      <div>
                        <Badge variant="outline" className="mr-1 px-1.5 py-0 text-[10px]">
                          Egresó
                        </Badge>
                        el {dma(n.egreso)}
                        {n.motivoEgreso && <span className="block text-xs text-muted-foreground">{n.motivoEgreso}</span>}
                      </div>
                    ) : (
                      <div>
                        <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${NIVEL_CLASS.green}`}>
                          Activo
                        </Badge>
                        {n.ultimoDia && (
                          <span className="ml-1 text-xs text-muted-foreground">último día con horas: {dma(n.ultimoDia).slice(0, 5)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-sm">
                    {n.expedienteReservado ? (
                      <p className="text-xs text-muted-foreground">Tiene un expediente vinculado que tu rol no ve.</p>
                    ) : canLoad && n.opciones.length > 0 ? (
                      <div className="space-y-1">
                        <ExpedienteSelect
                          agreementId={convenio.id}
                          nnyaId={n.id}
                          actual={n.expediente?.id ?? null}
                          opciones={n.opciones}
                          nombre={nombre}
                        />
                        {n.expediente && (
                          <Link href={`/cases/${n.expediente.id}`} className="text-xs font-semibold text-primary hover:underline">
                            Abrir el expediente
                          </Link>
                        )}
                      </div>
                    ) : n.expediente ? (
                      <Link href={`/cases/${n.expediente.id}`} className="font-semibold text-primary hover:underline">
                        {n.expediente.title}
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {n.opciones.length === 0 ? "No tiene expedientes en la app." : "Sin expediente vinculado."}
                      </p>
                    )}
                  </div>
                  {canLoad && (
                    <div className="flex justify-start md:justify-end">
                      {n.egreso ? (
                        <ReingresoButton agreementId={convenio.id} nnyaId={n.id} nombre={nombre} />
                      ) : (
                        <EgresoButton
                          agreementId={convenio.id}
                          nnya={{ id: n.id, nombre, ingreso: n.ingreso, ultimoDia: n.ultimoDia }}
                          today={today}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

function CuidadorasTotales({ filas }: { filas: { id: string; nombre: string; horas: number; importe: number }[] }) {
  const total = filas.reduce((a, f) => ({ horas: a.horas + f.horas, importe: a.importe + f.importe }), { horas: 0, importe: 0 });
  return (
    <Table mobileCards={false}>
      <TableHeader>
        <TableRow>
          <TableHead>Cuidadora</TableHead>
          <TableHead className="text-right">Horas</TableHead>
          <TableHead className="text-right">A facturar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-semibold">{c.nombre}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">{horasTexto(c.horas)}</TableCell>
            <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatPesos(c.importe)}</TableCell>
          </TableRow>
        ))}
        {filas.length > 1 && (
          <TableRow className="bg-muted/30">
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="whitespace-nowrap text-right font-bold tabular-nums">{horasTexto(total.horas)}</TableCell>
            <TableCell className="whitespace-nowrap text-right font-bold tabular-nums">{formatPesos(total.importe)}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Carga diaria
// ---------------------------------------------------------------------------

async function Carga({
  convenio,
  dia,
  today,
  canLoad,
  canConfig,
}: {
  convenio: Convenio;
  dia: string;
  today: string;
  canLoad: boolean;
  canConfig: boolean;
}) {
  const dayISO = dia > today ? today : dia;
  const [{ filas, valorHora }, cuidadoras, nnyas, cerrados] = await Promise.all([
    getDia(convenio.id, dayISO),
    getCuidadoras(convenio.id),
    getNnyaRecientes(convenio.id, today),
    getPeriodosCerrados(convenio.id),
  ]);
  const cerrado = cerrados.find((c) => c.desde <= dayISO && dayISO <= c.hasta) ?? null;
  // Un día de un período cerrado se ve, pero no se toca.
  if (cerrado) canLoad = false;
  const activas = cuidadoras.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre }));
  // Al corregir una fila se puede dejar la cuidadora que tenía, aunque ya esté de baja.
  const todas = cuidadoras.map((c) => ({
    id: c.id,
    nombre: c.activa ? c.nombre : `${c.nombre} (de baja)`,
  }));
  const totalHoras = filas.reduce((a, f) => a + f.horas, 0);
  const totalImporte = filas.reduce((a, f) => a + (f.importe ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-base first-letter:uppercase">{formatFechaLarga(`${dayISO}T12:00:00.000Z`)}</CardTitle>
            <CardDescription>
              {valorHora === null ? (
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  No hay valor hora para este día. {canConfig ? "Cargalo en “Valor hora y tope”." : "Lo carga la conducción."}
                </span>
              ) : (
                <>Valor de la hora: {formatPesos(valorHora)}</>
              )}
            </CardDescription>
          </div>
          <DiaPicker agreementId={convenio.id} dia={dayISO} today={today} />
        </CardHeader>
        <CardContent className="space-y-4">
          {cerrado && (
            <p className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Este día es del período del {periodoTexto(cerrado)}, que ya está cerrado: sus horas no se cambian. Si hace falta, la
                conducción lo reabre desde el Tablero.
              </span>
            </p>
          )}
          {canLoad && activas.length === 0 && (
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              Para cargar horas, primero sumá a las cuidadoras en la pestaña{" "}
              <Link href={`/convenios/${convenio.id}?ver=cuidadoras`} className="font-semibold underline">
                Cuidadoras
              </Link>
              .
            </p>
          )}
          {canLoad && activas.length > 0 && valorHora !== null && (
            <>
              <NuevasHorasForm agreementId={convenio.id} dia={dayISO} cuidadoras={activas} nnyas={nnyas} />
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
                <RepetirDiaButton agreementId={convenio.id} dia={dayISO} />
                <p className="text-xs text-muted-foreground">
                  Copia las horas del {dma(addDay(dayISO, -1)).slice(0, 5)} a este día (para quien sigue con acompañamiento).
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Horas cargadas del día</CardTitle>
          <CardDescription>
            {filas.length === 0
              ? "Todavía no hay horas este día."
              : `${horasTexto(totalHoras)} · ${valorHora === null ? "sin valor hora" : formatPesos(totalImporte)}`}
          </CardDescription>
        </CardHeader>
        {filas.length > 0 && (
          <CardContent>
            <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 md:hidden">
              {filas.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 px-3 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <Link href={`/people/${f.dni}`} className="block truncate text-sm font-semibold text-foreground">
                      {f.nombre || `DNI ${f.dni}`}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {f.cuidadora} · {LUGARES[f.lugar]}
                      {f.lugarDetalle ? ` (${f.lugarDetalle})` : ""}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {horasTexto(f.horas)} · {f.importe === null ? "sin valor hora" : formatPesos(f.importe)}
                    </p>
                    {f.observacion && <p className="whitespace-pre-line text-xs text-muted-foreground">{f.observacion}</p>}
                    {(f.cargo || f.cambio) && (
                      <p className="text-[11px] text-muted-foreground">
                        {f.cargo ? `Cargó ${f.cargo}` : ""}
                        {f.cambio ? ` · corrigió ${f.cambio}` : ""}
                      </p>
                    )}
                  </div>
                  {canLoad && (
                    <FilaActions
                      agreementId={convenio.id}
                      fila={f}
                      cuidadoras={todas}
                      nnyas={nnyas}
                      dia={dayISO}
                      descripcion={`las horas de ${f.cuidadora} con ${f.nombre || `DNI ${f.dni}`}`}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table mobileCards={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuidadora</TableHead>
                    <TableHead>NNyA</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead>Dónde</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    {canLoad && (
                      <TableHead className="w-24">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <p className="font-semibold">{f.cuidadora}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.cargo ? `Cargó ${f.cargo}` : ""}
                          {f.cambio ? ` · corrigió ${f.cambio}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Link href={`/people/${f.dni}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                          {f.nombre || "Sin nombre"}
                        </Link>
                        <p className="text-xs text-muted-foreground">DNI {f.dni}</p>
                        {f.observacion && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{f.observacion}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{horasTexto(f.horas)}</TableCell>
                      <TableCell className="text-sm">
                        {LUGARES[f.lugar]}
                        {f.lugarDetalle && <p className="text-xs text-muted-foreground">{f.lugarDetalle}</p>}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {f.importe === null ? "—" : formatPesos(f.importe)}
                      </TableCell>
                      {canLoad && (
                        <TableCell>
                          <FilaActions
                            agreementId={convenio.id}
                            fila={f}
                            cuidadoras={todas}
                            nnyas={nnyas}
                            dia={dayISO}
                            descripcion={`las horas de ${f.cuidadora} con ${f.nombre || `DNI ${f.dni}`}`}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

const addDay = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Cuidadoras
// ---------------------------------------------------------------------------

async function Cuidadoras({
  convenio,
  periodo,
  startDay,
  today,
  canLoad,
}: {
  convenio: Convenio;
  periodo: Periodo;
  startDay: number;
  today: string;
  canLoad: boolean;
}) {
  const [cuidadoras, r] = await Promise.all([getCuidadoras(convenio.id), getResumenPeriodo(convenio, periodo, today)]);
  const delPeriodo = new Map(r.porCuidadora.map((c) => [c.id, c]));
  return (
    <div className="space-y-6">
      <PeriodoNav id={convenio.id} ver="cuidadoras" periodo={periodo} startDay={startDay} today={today} />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Cuidadoras del convenio</CardTitle>
          <CardDescription>Las que se eligen al cargar horas, con lo que hizo cada una en el período.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canLoad && <NuevaCuidadoraForm agreementId={convenio.id} />}
          {cuidadoras.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              Todavía no hay cuidadoras en la lista.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuidadora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Horas del período</TableHead>
                  <TableHead className="text-right">A facturar</TableHead>
                  {canLoad && (
                    <TableHead className="w-48">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuidadoras.map((c) => {
                  const t = delPeriodo.get(c.id);
                  return (
                    <TableRow key={c.id} className={c.activa ? undefined : "opacity-60"}>
                      <TableCell>
                        <p className="font-semibold">{c.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {[c.dni ? `DNI ${c.dni}` : null, c.telefono].filter(Boolean).join(" · ") || "Sin DNI ni teléfono"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{c.activa ? "Activa" : "De baja"}</TableCell>
                      <TableCell className="text-right tabular-nums">{t ? horasTexto(t.horas) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{t ? formatPesos(t.importe) : "—"}</TableCell>
                      {canLoad && (
                        <TableCell>
                          <CuidadoraActions agreementId={convenio.id} cuidadora={c} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Valor hora y tope
// ---------------------------------------------------------------------------

async function Ajustes({ convenio, today, canConfig }: { convenio: Convenio; today: string; canConfig: boolean }) {
  const valores = await getValoresHora(convenio.id);
  const alertas = convenio.alertPercents?.length === 3 ? convenio.alertPercents : DEFAULT_ALERT_PERCENTS;
  const vigente = valores.find((v) => v.desde <= today) ?? null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Valor de la hora</CardTitle>
          <CardDescription>
            Cada día se calcula con el valor que regía ese día. Un aumento desde una fecha no cambia los días anteriores.
            {vigente && <> Hoy rige {formatPesos(vigente.valor)}.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canConfig && <ValorHoraForm agreementId={convenio.id} today={today} />}
          <ul className="divide-y divide-border/50 rounded-2xl border border-border/60">
            {valores.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold tabular-nums">{formatPesos(v.valor)} la hora</p>
                  <p className="text-xs text-muted-foreground">
                    Desde el {dma(v.desde)}
                    {v === vigente ? " · rige hoy" : v.desde > today ? " · todavía no rige" : ""}
                  </p>
                </div>
                {canConfig && (
                  <BorrarValorButton agreementId={convenio.id} id={v.id} label={`${formatPesos(v.valor)} desde el ${dma(v.desde)}`} />
                )}
              </li>
            ))}
          </ul>
          {canConfig && <p className="text-xs text-muted-foreground">Para corregir un valor, cargalo de nuevo con la misma fecha.</p>}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Tope, período y avisos</CardTitle>
          <CardDescription>
            {canConfig
              ? "Los cambia la conducción."
              : `Tope ${formatPesos(Number(convenio.monthlyCap ?? 0))} por período, que empieza el día ${convenio.periodStartDay ?? 1} de cada mes. Avisos al ${alertas.join(", ")} %.`}
          </CardDescription>
        </CardHeader>
        {canConfig && (
          <CardContent>
            <ConfigurarControlForm
              agreementId={convenio.id}
              inicial={{
                monthlyCap: Number(convenio.monthlyCap ?? 0),
                periodStartDay: convenio.periodStartDay ?? 1,
                alertPercents: alertas,
              }}
              today={today}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
