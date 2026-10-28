"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ASISTENCIA_MINIMA_DEFAULT, CURSO_LIMITS, CURSO_TIPOS } from "@/lib/cursos";
import {
  abrirClaseAction, borrarClaseAction, deleteCursoAction, inscribirAction, marcarDejoAction, saveCursoAction, terminarCursoAction,
  volverAInscribirAction,
} from "@/app/(dashboard)/cursos/actions";

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const failed = (res: { success: boolean; error?: string } | null) =>
  toast.error(res && !res.success && res.error ? res.error : "No se pudo guardar. Probá de nuevo.");

export type CursoFormValues = {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  areaId: string | null;
  programa: string | null;
  docente: string | null;
  lugar: string | null;
  horario: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  cargaHoraria: number | null;
  asistenciaMinima: number;
};

type Option = { id: string; name: string };
type ProgramOption = { column: string; label: string };

const EMPTY = {
  nombre: "",
  tipo: "CURSO",
  descripcion: "",
  areaId: "",
  programa: "",
  docente: "",
  lugar: "",
  horario: "",
  fechaInicio: "",
  fechaFin: "",
  cargaHoraria: "",
  asistenciaMinima: String(ASISTENCIA_MINIMA_DEFAULT),
};

/** Crear un curso o taller, o cambiar sus datos si se pasa `curso`. */
export function CursoDialog({
  curso,
  areas,
  programas,
  canChooseArea,
  defaultAreaId,
  today,
}: {
  curso?: CursoFormValues;
  areas: Option[];
  programas: ProgramOption[];
  canChooseArea: boolean;
  defaultAreaId: string | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const reset = () =>
    setForm(
      curso
        ? {
            nombre: curso.nombre,
            tipo: curso.tipo,
            descripcion: curso.descripcion ?? "",
            areaId: curso.areaId ?? "",
            programa: curso.programa ?? "",
            docente: curso.docente ?? "",
            lugar: curso.lugar ?? "",
            horario: curso.horario ?? "",
            fechaInicio: curso.fechaInicio,
            fechaFin: curso.fechaFin ?? "",
            cargaHoraria: curso.cargaHoraria?.toString() ?? "",
            asistenciaMinima: String(curso.asistenciaMinima),
          }
        : { ...EMPTY, areaId: defaultAreaId ?? "", fechaInicio: today }
    );

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // El programa elegido puede no estar entre los que el usuario maneja (lo eligió otra persona): se muestra igual.
  const programOptions =
    curso?.programa && !programas.some((p) => p.column === curso.programa)
      ? [...programas, { column: curso.programa, label: "El programa elegido (de otra área)" }]
      : programas;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error("Escribí el nombre del curso.");
    setSaving(true);
    const res = await saveCursoAction(curso?.id ?? null, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(curso ? "Datos guardados." : "Curso creado. Ahora sumá a los inscriptos.");
    setOpen(false);
    if (!curso && "id" in res) router.push(`/cursos/${res.id}`);
    else router.refresh();
  };

  const id = (name: string) => `curso-${curso?.id ?? "nuevo"}-${name}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        {curso ? (
          <Button variant="outline" className="rounded-2xl h-11 px-4 font-bold text-xs gap-2">
            <Pencil className="h-4 w-4" /> Cambiar datos
          </Button>
        ) : (
          <Button className="rounded-2xl h-11 px-5 font-bold text-xs gap-2">
            <Plus className="h-4 w-4" /> Nuevo curso o taller
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <DialogHeader>
            <DialogTitle>{curso ? `Datos de ${curso.nombre}` : "Nuevo curso o taller"}</DialogTitle>
            <DialogDescription>
              Lo que se escriba acá sale en la lista de asistencia y en el certificado. Lo opcional se puede completar después.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor={id("nombre")}>Nombre</Label>
              <Input id={id("nombre")} value={form.nombre} onChange={set("nombre")} maxLength={CURSO_LIMITS.nombre} required placeholder="Electricidad domiciliaria" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("tipo")}>Es un</Label>
              <select id={id("tipo")} value={form.tipo} onChange={set("tipo")} className={selectClass}>
                {CURSO_TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {canChooseArea && (
              <div className="space-y-1.5">
                <Label htmlFor={id("area")}>Área</Label>
                <select id={id("area")} value={form.areaId} onChange={set("areaId")} className={selectClass}>
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={canChooseArea ? "space-y-1.5" : "space-y-1.5 sm:col-span-2"}>
              <Label htmlFor={id("programa")}>Programa del padrón (opcional)</Label>
              <select id={id("programa")} value={form.programa} onChange={set("programa")} className={selectClass}>
                <option value="">Ninguno</option>
                {programOptions.map((p) => (
                  <option key={p.column} value={p.column}>{p.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Si elegís uno, cada persona que se inscribe queda de alta en ese programa.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("inicio")}>Empieza</Label>
              <Input id={id("inicio")} type="date" value={form.fechaInicio} onChange={set("fechaInicio")} required className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("fin")}>Termina (opcional)</Label>
              <Input id={id("fin")} type="date" value={form.fechaFin} min={form.fechaInicio || undefined} onChange={set("fechaFin")} className="rounded-xl" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("horario")}>Días y horario (opcional)</Label>
              <Input id={id("horario")} value={form.horario} onChange={set("horario")} maxLength={CURSO_LIMITS.horario} placeholder="Lunes y miércoles de 18 a 20" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("lugar")}>Lugar (opcional)</Label>
              <Input id={id("lugar")} value={form.lugar} onChange={set("lugar")} maxLength={CURSO_LIMITS.lugar} placeholder="Centro de Formación, Caseros" className="rounded-xl" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={id("docente")}>Docente (opcional)</Label>
              <Input id={id("docente")} value={form.docente} onChange={set("docente")} maxLength={CURSO_LIMITS.docente} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("horas")}>Carga horaria (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input id={id("horas")} type="number" inputMode="numeric" min={1} value={form.cargaHoraria} onChange={set("cargaHoraria")} className="rounded-xl" />
                <span className="text-sm text-muted-foreground">horas</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("minima")}>Asistencia para el certificado</Label>
              <div className="flex items-center gap-2">
                <Input id={id("minima")} type="number" inputMode="numeric" min={0} max={100} value={form.asistenciaMinima} onChange={set("asistenciaMinima")} className="rounded-xl" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={id("descripcion")}>De qué se trata (opcional)</Label>
            <Textarea id={id("descripcion")} value={form.descripcion} onChange={set("descripcion")} maxLength={CURSO_LIMITS.descripcion} rows={2} className="rounded-xl" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {curso ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Dar por terminado" (con cuántos tienen certificado) o "Volver a abrir". */
export function TerminarCursoButton({
  id,
  terminado,
  conCertificado,
  inscriptos,
  asistenciaMinima,
}: {
  id: string;
  terminado: boolean;
  conCertificado: number;
  inscriptos: number;
  asistenciaMinima: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    setSaving(true);
    const res = await terminarCursoAction(id, !terminado).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(terminado ? "El curso quedó abierto de nuevo." : "Curso terminado. Ya se pueden imprimir los certificados.");
    setOpen(false);
    router.refresh();
  };

  if (terminado) {
    return (
      <Button variant="outline" onClick={run} disabled={saving} className="rounded-2xl h-11 px-4 font-bold text-xs gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Volver a abrir
      </Button>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl h-11 px-4 font-bold text-xs gap-2">
          <CheckCircle2 className="h-4 w-4" /> Dar por terminado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Dar el curso por terminado?</DialogTitle>
          <DialogDescription>
            {asistenciaMinima > 0
              ? `Con la asistencia anotada, ${conCertificado} de ${inscriptos} inscriptos llegan al ${asistenciaMinima} % y van a tener certificado.`
              : `Los ${inscriptos} inscriptos van a tener certificado.`}{" "}
            Después no se toma más asistencia. Si hace falta corregir algo, se puede volver a abrir.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={run} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Dar por terminado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCursoButton({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const run = async () => {
    if (!window.confirm(`¿Borrar "${nombre}"? Se borran también sus inscriptos. Las altas en el programa quedan como están.`)) return;
    setSaving(true);
    const res = await deleteCursoAction(id).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Curso borrado.");
    router.push("/cursos");
  };
  return (
    <Button variant="ghost" onClick={run} disabled={saving} className="rounded-2xl h-11 px-3 font-bold text-xs gap-2 text-destructive hover:text-destructive">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Borrar
    </Button>
  );
}

/** Inscribir por DNI. Si el curso es de un programa, avisa que también quedó de alta en él. */
export function InscribirForm({ cursoId, today, compact = false }: { cursoId: string; today: string; compact?: boolean }) {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [dia, setDia] = useState(today);
  const [otroDia, setOtroDia] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim()) return toast.error("Escribí el DNI.");
    setSaving(true);
    const res = await inscribirAction(cursoId, dni, otroDia ? dia : today).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    const r = res as { nombre?: string | null; altaPrograma?: string | null };
    toast.success(`${r.nombre || "La persona"} quedó inscripta${r.altaPrograma ? ` y de alta en ${r.altaPrograma}` : ""}.`);
    setDni("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`inscribir-${cursoId}`}>{compact ? "Se sumó alguien: DNI" : "Inscribir por DNI"}</Label>
          <Input
            id={`inscribir-${cursoId}`}
            inputMode="numeric"
            autoComplete="off"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="Sin puntos"
            className="h-11 rounded-xl"
          />
        </div>
        {otroDia && (
          <div className="space-y-1.5 sm:w-44">
            <Label htmlFor={`inscribir-dia-${cursoId}`}>Se inscribió el</Label>
            <Input id={`inscribir-dia-${cursoId}`} type="date" value={dia} max={today} onChange={(e) => setDia(e.target.value)} className="h-11 rounded-xl" />
          </div>
        )}
        <Button type="submit" disabled={saving} className="h-11 rounded-xl font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Inscribir
        </Button>
      </div>
      {!compact && !otroDia && (
        <button type="button" onClick={() => setOtroDia(true)} className="text-xs font-semibold text-primary hover:underline">
          Se inscribió otro día
        </button>
      )}
    </form>
  );
}

/** "Dejó el curso" (con el motivo y, si el curso es de un programa, la baja en él) o "Volvió". */
export function InscriptoActions({
  cursoId,
  inscriptoId,
  nombre,
  dejo,
  programa,
}: {
  cursoId: string;
  inscriptoId: string;
  nombre: string;
  dejo: boolean;
  programa: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [baja, setBaja] = useState(false);
  const [saving, setSaving] = useState(false);

  if (dejo) {
    const volver = async () => {
      setSaving(true);
      const res = await volverAInscribirAction(cursoId, inscriptoId).catch(() => null);
      setSaving(false);
      if (!res?.success) return failed(res);
      toast.success(`${nombre} vuelve a estar inscripto.`);
      router.refresh();
    };
    return (
      <Button variant="ghost" size="sm" onClick={volver} disabled={saving} className="h-8 rounded-xl text-xs font-semibold gap-1">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Volvió
      </Button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return toast.error("Escribí por qué dejó.");
    setSaving(true);
    const res = await marcarDejoAction(cursoId, inscriptoId, motivo, baja).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    const aviso = (res as { aviso?: string | null }).aviso;
    if (aviso) toast.warning(aviso);
    else toast.success(baja && programa ? `Anotado. También quedó de baja de ${programa}.` : "Anotado que dejó el curso.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setMotivo("");
          setBaja(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground">
          <UserMinus className="h-3.5 w-3.5" /> Dejó
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{nombre} dejó el curso</DialogTitle>
            <DialogDescription>Deja de aparecer en la lista de asistencia. Lo anotado hasta hoy queda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`dejo-${inscriptoId}`}>Por qué</Label>
            <Input id={`dejo-${inscriptoId}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={CURSO_LIMITS.motivo} placeholder="Consiguió trabajo, se mudó, no vino más…" className="rounded-xl" />
          </div>
          {programa && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={baja} onChange={(e) => setBaja(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
              <span>Darlo de baja también de <strong>{programa}</strong></span>
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Abre la clase de hoy (u otro día) y lleva a la lista para tomar asistencia. */
export function TomarAsistenciaButton({ cursoId, today, className = "" }: { cursoId: string; today: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dia, setDia] = useState(today);
  const [saving, setSaving] = useState(false);

  const go = async (day: string) => {
    setSaving(true);
    const res = await abrirClaseAction(cursoId, day).catch(() => null);
    if (!res?.success || !("id" in res)) {
      setSaving(false);
      return failed(res);
    }
    router.push(`/cursos/${cursoId}/clases/${res.id}`);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button onClick={() => go(today)} disabled={saving} className="h-11 rounded-2xl px-5 font-bold text-xs gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Tomar asistencia de hoy
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="h-11 rounded-2xl px-3 text-xs font-semibold">Otro día</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asistencia de otro día</DialogTitle>
            <DialogDescription>Para anotar una clase que ya pasó (por ejemplo, si se tomó en papel).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`clase-dia-${cursoId}`}>Día de la clase</Label>
            <Input id={`clase-dia-${cursoId}`} type="date" value={dia} max={today} onChange={(e) => setDia(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => go(dia)} disabled={saving || !dia} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Abrir la lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BorrarClaseButton({ cursoId, claseId, fecha }: { cursoId: string; claseId: string; fecha: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const run = async () => {
    if (!window.confirm(`¿Borrar la clase del ${fecha}? Se borra la asistencia anotada ese día.`)) return;
    setSaving(true);
    const res = await borrarClaseAction(cursoId, claseId).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Clase borrada.");
    router.push(`/cursos/${cursoId}`);
    router.refresh();
  };
  return (
    <Button variant="ghost" onClick={run} disabled={saving} className="rounded-2xl h-11 px-3 font-bold text-xs gap-2 text-destructive hover:text-destructive">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Borrar esta clase
    </Button>
  );
}
