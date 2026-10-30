"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Loader2, Pencil, Plus, Save, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_ALERT_PERCENTS, GASTO_LIMITS, LUGARES, type Lugar } from "@/lib/convenio-gasto";
import {
  activarCuidadoraAction, borrarCuidadoraAction, borrarHorasAction, borrarValorHoraAction, configurarControlAction, guardarCuidadoraAction,
  guardarHorasAction, guardarValorHoraAction, repetirDiaAnteriorAction,
} from "@/app/(dashboard)/convenios/actions";
import { RequiredMark } from "@/components/ui/form-section";
import { SumarNnyaDialog } from "@/components/convenios/nnya-ficha-controls";
import type { AddressOptions } from "@/lib/localidades";

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const failed = (res: { success: boolean; error?: string } | null) =>
  toast.error(res && !res.success && res.error ? res.error : "No se pudo guardar. Probá de nuevo.");

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Ajustes (conducción)
// ---------------------------------------------------------------------------

/** Tope, día de corte y avisos. La primera vez también pide el valor hora. */
export function ConfigurarControlForm({
  agreementId,
  inicial,
  today,
}: {
  agreementId: string;
  inicial: { monthlyCap: number; periodStartDay: number; alertPercents: number[] } | null;
  today: string;
}) {
  const router = useRouter();
  const primeraVez = !inicial;
  const alertas = inicial?.alertPercents?.length === 3 ? inicial.alertPercents : DEFAULT_ALERT_PERCENTS;
  const [form, setForm] = useState({
    monthlyCap: inicial ? String(inicial.monthlyCap) : "",
    periodStartDay: String(inicial?.periodStartDay ?? 1),
    alerta1: String(alertas[0]),
    alerta2: String(alertas[1]),
    alerta3: String(alertas[2]),
    valorHora: "",
    valorDesde: today,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await configurarControlAction(agreementId, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(primeraVez ? "Listo: el convenio ya tiene control por horas." : "Cambios guardados.");
    router.push(primeraVez ? `/convenios/${agreementId}` : `/convenios/${agreementId}?ver=ajustes`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="monthlyCap">Tope por período ($) <RequiredMark /></Label>
          <Input id="monthlyCap" inputMode="decimal" required value={form.monthlyCap} onChange={set("monthlyCap")} placeholder="Ej: 33000000" className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodStartDay">Cada período empieza el día <RequiredMark /></Label>
          <Input id="periodStartDay" type="number" min={1} max={28} required value={form.periodStartDay} onChange={set("periodStartDay")} aria-describedby="periodStartDay-hint" className="h-10 rounded-xl" />
          <p id="periodStartDay-hint" className="text-xs text-muted-foreground">
            Termina el día anterior del mes siguiente. Por ejemplo, con 20: del 20/09 al 19/10.
          </p>
        </div>
      </div>

      {primeraVez && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="valorHora">Valor hora ($) <RequiredMark /></Label>
            <Input id="valorHora" inputMode="decimal" required value={form.valorHora} onChange={set("valorHora")} placeholder="Ej: 12926" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valorDesde">Rige desde <RequiredMark /></Label>
            <Input id="valorDesde" type="date" required value={form.valorDesde} onChange={set("valorDesde")} className="h-10 rounded-xl" />
          </div>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Avisar cuando se gasta este porcentaje del tope</legend>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["alerta1", "Precaución", "text-amber-700 dark:text-amber-300"],
            ["alerta2", "Alerta", "text-orange-700 dark:text-orange-300"],
            ["alerta3", "Crítico", "text-rose-700 dark:text-rose-300"],
          ] as const).map(([k, label, tone]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={k} className={`text-xs font-semibold ${tone}`}>{label} (%)</Label>
              <Input id={k} type="number" min={1} max={100} value={form[k]} onChange={set(k)} className="h-10 rounded-xl" />
            </div>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={saving} className="h-10 rounded-xl gap-1.5 font-bold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {primeraVez ? "Empezar el control por horas" : "Guardar cambios"}
      </Button>
    </form>
  );
}

/** Un valor hora nuevo desde un día (o la corrección del de ese día). */
export function ValorHoraForm({ agreementId, today }: { agreementId: string; today: string }) {
  const router = useRouter();
  const [desde, setDesde] = useState(today);
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarValorHoraAction(agreementId, { desde, valor }).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Valor hora guardado.");
    setValor("");
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="space-y-1.5 sm:w-44">
        <Label htmlFor="nuevo-valor-desde">Desde el <RequiredMark /></Label>
        <Input id="nuevo-valor-desde" type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="nuevo-valor">Valor hora ($) <RequiredMark /></Label>
        <Input id="nuevo-valor" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej: 13500" className="h-10 rounded-xl" />
      </div>
      <Button type="submit" disabled={saving} className="h-10 rounded-xl gap-1.5 font-bold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cargar valor
      </Button>
    </form>
  );
}

export function BorrarValorButton({ agreementId, id, label }: { agreementId: string; id: string; label: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const run = async () => {
    if (!window.confirm(`¿Borrar el valor ${label}?`)) return;
    setSaving(true);
    const res = await borrarValorHoraAction(agreementId, id).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Valor borrado.");
    router.refresh();
  };
  return (
    <Button variant="ghost" size="icon" onClick={run} disabled={saving} aria-label={`Borrar el valor ${label}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Cuidadoras
// ---------------------------------------------------------------------------

type Cuidadora = { id: string; nombre: string; dni: string | null; telefono: string | null; activa: boolean; filas: number };

function CuidadoraFields({ form, setForm, idPrefix }: { form: { nombre: string; dni: string; telefono: string }; setForm: (f: { nombre: string; dni: string; telefono: string }) => void; idPrefix: string }) {
  return (
    <>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor={`${idPrefix}-nombre`}>Nombre y apellido <RequiredMark /></Label>
        <Input id={`${idPrefix}-nombre`} required maxLength={GASTO_LIMITS.nombre} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5 sm:w-36">
        <Label htmlFor={`${idPrefix}-dni`}>DNI (opcional)</Label>
        <Input id={`${idPrefix}-dni`} inputMode="numeric" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5 sm:w-40">
        <Label htmlFor={`${idPrefix}-tel`}>Teléfono (opcional)</Label>
        <Input id={`${idPrefix}-tel`} inputMode="tel" maxLength={GASTO_LIMITS.telefono} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="h-10 rounded-xl" />
      </div>
    </>
  );
}

export function NuevaCuidadoraForm({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", dni: "", telefono: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarCuidadoraAction(agreementId, null, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(`${form.nombre.trim()} quedó en la lista.`);
    setForm({ nombre: "", dni: "", telefono: "" });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <CuidadoraFields form={form} setForm={setForm} idPrefix="nueva-cuidadora" />
      <Button type="submit" disabled={saving} className="h-10 rounded-xl gap-1.5 font-bold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Sumar
      </Button>
    </form>
  );
}

export function CuidadoraActions({ agreementId, cuidadora }: { agreementId: string; cuidadora: Cuidadora }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: cuidadora.nombre, dni: cuidadora.dni ?? "", telefono: cuidadora.telefono ?? "" });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarCuidadoraAction(agreementId, cuidadora.id, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Datos guardados.");
    setOpen(false);
    router.refresh();
  };
  const toggle = async () => {
    if (cuidadora.activa && !window.confirm(`¿Dar de baja a ${cuidadora.nombre}? Sus horas cargadas quedan; no se le pueden cargar horas nuevas.`)) return;
    setSaving(true);
    const res = await activarCuidadoraAction(agreementId, cuidadora.id, !cuidadora.activa).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(cuidadora.activa ? `${cuidadora.nombre} quedó de baja.` : `${cuidadora.nombre} volvió a la lista.`);
    router.refresh();
  };
  const remove = async () => {
    if (!window.confirm(`¿Borrar a ${cuidadora.nombre} de la lista?`)) return;
    setSaving(true);
    const res = await borrarCuidadoraAction(agreementId, cuidadora.id).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Borrada de la lista.");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Cambiar los datos de ${cuidadora.nombre}`} className="h-8 w-8 rounded-lg">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Datos de la cuidadora</DialogTitle>
              <DialogDescription>El cambio de nombre se ve también en las horas que ya tiene cargadas.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <CuidadoraFields form={form} setForm={setForm} idPrefix={`cuidadora-${cuidadora.id}`} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="sm" onClick={toggle} disabled={saving} className="h-8 rounded-lg gap-1 text-xs font-semibold">
        {cuidadora.activa ? <><UserMinus className="h-4 w-4" /> Dar de baja</> : <><UserPlus className="h-4 w-4" /> Volver a sumar</>}
      </Button>
      {cuidadora.filas === 0 && (
        <Button variant="ghost" size="icon" onClick={remove} disabled={saving} aria-label={`Borrar a ${cuidadora.nombre}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horas de cada día
// ---------------------------------------------------------------------------

type Opcion = { id: string; nombre: string };
type Nnya = { dni: string; nombre: string | null; egresado?: boolean };
type Sumar = { addressOptions: AddressOptions; puedeCargarPersona: boolean };
export type FilaEditable = {
  id: string;
  cuidadoraId: string | null;
  dni: string;
  nombre: string | null;
  horas: number;
  lugar: Lugar;
  lugarDetalle: string | null;
  observacion: string | null;
};

const SUMAR = "__sumar__";

function HorasFields({
  agreementId,
  form,
  setForm,
  cuidadoras,
  nnyas,
  sumar,
  idPrefix,
}: {
  agreementId: string;
  form: { cuidadoraId: string; dni: string; horas: string; lugar: string; lugarDetalle: string; observacion: string };
  setForm: (f: any) => void;
  cuidadoras: Opcion[];
  nnyas: Nnya[];
  /** Si viene, se puede sumar al convenio a alguien que no está en la lista (buscándolo en el Registro Único). */
  sumar?: Sumar;
  idPrefix: string;
}) {
  // Los que se suman desde acá aparecen enseguida, antes de que se recargue la lista.
  const [sumados, setSumados] = useState<Nnya[]>([]);
  const [sumando, setSumando] = useState(false);
  const opciones = [...nnyas, ...sumados.filter((s) => !nnyas.some((n) => n.dni === s.dni))].sort((a, b) =>
    (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni, "es")
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor={`${idPrefix}-nnya`}>Niño, niña o adolescente <RequiredMark /></Label>
        <select
          id={`${idPrefix}-nnya`}
          required
          value={form.dni}
          onChange={(e) => (e.target.value === SUMAR ? setSumando(true) : setForm({ ...form, dni: e.target.value }))}
          className={selectClass}
        >
          <option value="">{opciones.length === 0 ? "Todavía no hay nadie en la lista" : "Elegí…"}</option>
          {opciones.map((n) => <option key={n.dni} value={n.dni}>{n.nombre ? `${n.nombre} (DNI ${n.dni})` : `DNI ${n.dni}`}{n.egresado ? " · con egreso" : ""}</option>)}
          {sumar && <option value={SUMAR}>+ Sumar otro niño o niña…</option>}
        </select>
        {sumar && (
          <SumarNnyaDialog
            agreementId={agreementId}
            addressOptions={sumar.addressOptions}
            puedeCargarPersona={sumar.puedeCargarPersona}
            trigger={false}
            open={sumando}
            onOpenChange={setSumando}
            onSumado={(n) => {
              setSumados((prev) => [...prev, { dni: n.dni, nombre: n.nombre }]);
              setForm({ ...form, dni: n.dni });
            }}
          />
        )}
      </div>
      <div className="space-y-1.5 lg:col-span-1">
        <Label htmlFor={`${idPrefix}-horas`}>Horas <RequiredMark /></Label>
        <Input id={`${idPrefix}-horas`} inputMode="decimal" required value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} placeholder="Ej: 24" className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5 lg:col-span-1">
        <Label htmlFor={`${idPrefix}-lugar`}>Dónde <RequiredMark /></Label>
        <select id={`${idPrefix}-lugar`} required value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} className={selectClass}>
          {Object.entries(LUGARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
        <Label htmlFor={`${idPrefix}-lugar-detalle`}>Cuál (opcional)</Label>
        <Input id={`${idPrefix}-lugar-detalle`} maxLength={GASTO_LIMITS.lugarDetalle} value={form.lugarDetalle} onChange={(e) => setForm({ ...form, lugarDetalle: e.target.value })} placeholder="Ej: Hospital Bocalandro" className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor={`${idPrefix}-cuidadora`}>Cuidadora (opcional)</Label>
        <select id={`${idPrefix}-cuidadora`} value={form.cuidadoraId} onChange={(e) => setForm({ ...form, cuidadoraId: e.target.value })} className={selectClass}>
          <option value="">{cuidadoras.length === 0 ? "No hay cuidadoras en la lista" : "Sin cargar"}</option>
          {cuidadoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-1.5 lg:col-span-4">
        <Label htmlFor={`${idPrefix}-obs`}>Observación (opcional)</Label>
        <Textarea id={`${idPrefix}-obs`} rows={1} maxLength={GASTO_LIMITS.observacion} value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} className="min-h-10 rounded-xl" />
      </div>
    </div>
  );
}

const formDe = (fila: FilaEditable | null) => ({
  cuidadoraId: fila?.cuidadoraId ?? "",
  dni: fila?.dni ?? "",
  horas: fila ? String(fila.horas).replace(".", ",") : "",
  lugar: fila?.lugar ?? "HOSPITAL",
  lugarDetalle: fila?.lugarDetalle ?? "",
  observacion: fila?.observacion ?? "",
});

/**
 * Cargar las horas de un niño, niña o adolescente en el día elegido (la cuidadora es opcional).
 * Se elige de la lista del convenio (sin los que egresaron); si no está, se suma desde el Registro Único.
 */
export function NuevasHorasForm({
  agreementId,
  dia,
  cuidadoras,
  nnyas,
  sumar,
}: {
  agreementId: string;
  dia: string;
  cuidadoras: Opcion[];
  nnyas: Nnya[];
  sumar?: Sumar;
}) {
  const router = useRouter();
  const [form, setForm] = useState(formDe(null));
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarHorasAction(agreementId, null, { ...form, fecha: dia }).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Horas cargadas.");
    // Se quedan el lugar y la cuidadora: suele cargarse otro chico o chica en el mismo lugar.
    setForm({ ...form, dni: "", horas: "", observacion: "" });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <HorasFields agreementId={agreementId} form={form} setForm={setForm} cuidadoras={cuidadoras} nnyas={nnyas.filter((n) => !n.egresado)} sumar={sumar} idPrefix="nuevas-horas" />
      <Button type="submit" disabled={saving} className="h-10 rounded-xl gap-1.5 font-bold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cargar horas
      </Button>
    </form>
  );
}

export function FilaActions({
  agreementId,
  fila,
  cuidadoras,
  nnyas,
  dia,
  descripcion,
}: {
  agreementId: string;
  fila: FilaEditable;
  cuidadoras: Opcion[];
  nnyas: Nnya[];
  dia: string;
  descripcion: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(formDe(fila));
  const [fecha, setFecha] = useState(dia);
  const [saving, setSaving] = useState(false);
  // Al corregir se puede dejar a quien ya tenía la fila, aunque haya egresado.
  const opciones = nnyas.some((n) => n.dni === fila.dni) ? nnyas : [...nnyas, { dni: fila.dni, nombre: fila.nombre }];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarHorasAction(agreementId, fila.id, { ...form, fecha }).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Fila corregida.");
    setOpen(false);
    router.refresh();
  };
  const remove = async () => {
    if (!window.confirm(`¿Borrar ${descripcion}?`)) return;
    setSaving(true);
    const res = await borrarHorasAction(agreementId, fila.id).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Fila borrada.");
    router.refresh();
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Corregir ${descripcion}`} className="h-8 w-8 rounded-lg">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Corregir horas</DialogTitle>
              <DialogDescription>Queda registrado quién la corrigió.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 sm:w-48">
              <Label htmlFor={`fila-${fila.id}-fecha`}>Día <RequiredMark /></Label>
              <Input id={`fila-${fila.id}-fecha`} type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <HorasFields agreementId={agreementId} form={form} setForm={setForm} cuidadoras={cuidadoras} nnyas={opciones} idPrefix={`fila-${fila.id}`} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="icon" onClick={remove} disabled={saving} aria-label={`Borrar ${descripcion}`} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Copia las horas del día anterior al día elegido. */
export function RepetirDiaButton({ agreementId, dia }: { agreementId: string; dia: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const run = async () => {
    setSaving(true);
    const res = await repetirDiaAnteriorAction(agreementId, dia).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    const r = res as { copiadas: number; salteadas: number };
    toast.success(
      `Se ${r.copiadas === 1 ? "copió 1 fila" : `copiaron ${r.copiadas} filas`} del día anterior.` +
        (r.salteadas ? ` ${r.salteadas === 1 ? "Una ya estaba o es de una cuidadora de baja" : `${r.salteadas} ya estaban o son de cuidadoras de baja`}.` : "")
    );
    router.refresh();
  };
  return (
    <Button variant="outline" onClick={run} disabled={saving} className="h-10 rounded-xl gap-1.5 font-bold">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Repetir el día anterior
    </Button>
  );
}

/** Elegir el día que se carga: anterior, siguiente o cualquiera del calendario. */
export function DiaPicker({ agreementId, dia, today }: { agreementId: string; dia: string; today: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`/convenios/${agreementId}?ver=carga&dia=${d}`);
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" onClick={() => go(addDays(dia, -1))} aria-label="Día anterior" className="h-10 w-10 rounded-xl">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        aria-label="Día que se carga"
        value={dia}
        max={today}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="h-10 w-44 rounded-xl"
      />
      <Button variant="outline" size="icon" onClick={() => go(addDays(dia, 1))} disabled={dia >= today} aria-label="Día siguiente" className="h-10 w-10 rounded-xl">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {dia !== today && (
        <Button variant="ghost" onClick={() => go(today)} className="h-10 rounded-xl text-xs font-bold">Hoy</Button>
      )}
    </div>
  );
}
