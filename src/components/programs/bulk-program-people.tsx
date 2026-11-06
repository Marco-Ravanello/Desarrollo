"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequiredMark } from "@/components/ui/form-section";
import { cn } from "@/lib/utils";
import { BULK_MAX, bulkSummary, type BulkOutcome } from "@/lib/program-bulk";
import { bulkEnrollAction, bulkWithdrawAction, previewBulkEnrollAction } from "@/app/(dashboard)/people/actions/program-enrollment-actions";

// Altas y bajas de varias personas juntas, desde la lista de un programa.

type Mode = "alta" | "baja";
export type BulkRow = { dni: string; nombre: string | null; cells: ReactNode[] };

const NOTE_MAX = 300;
const personas = (n: number) => (n === 1 ? "1 persona" : `${n} personas`);

/** Lo que no se pudo, persona por persona. */
function Skipped({ outcome }: { outcome: BulkOutcome }) {
  if (!outcome.skipped.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{outcome.skipped.length === 1 ? "Esta no se pudo:" : "Estas no se pudieron:"}</p>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2 text-sm">
        {outcome.skipped.map((s) => (
          <li key={s.dni} className="flex flex-wrap gap-x-2">
            <span className="font-semibold text-foreground">{s.nombre || `DNI ${s.dni}`}</span>
            <span className="text-muted-foreground">{s.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La fecha y el motivo (o la nota), y el resultado cuando ya se hizo. */
function MoveFields({ mode, today, day, setDay, text, setText, idPrefix }: {
  mode: Mode; today: string; day: string; setDay: (v: string) => void; text: string; setText: (v: string) => void; idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-fecha`}>{mode === "alta" ? "Fecha del alta" : "Fecha de la baja"}</Label>
        <Input id={`${idPrefix}-fecha`} type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-texto`}>
          {mode === "alta" ? "Nota (opcional)" : <>Motivo de la baja<RequiredMark /></>}
        </Label>
        <Textarea
          id={`${idPrefix}-texto`}
          value={text}
          maxLength={NOTE_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "alta" ? "Por ejemplo: operativo en el barrio" : "Por ejemplo: terminó el ciclo del programa"}
          className="rounded-xl"
        />
        {mode === "baja" && <p className="text-xs text-muted-foreground">Es el mismo motivo para todas. Queda en la historia de cada persona.</p>}
      </div>
    </div>
  );
}

/**
 * La tabla de personas con casillas para elegir varias y darles el alta o la baja juntas.
 * Sin permiso, es la misma tabla sin casillas.
 */
export function BulkSelectTable({ mode, column, programLabel, today, headers, rows, canManage }: {
  mode: Mode;
  column: string;
  programLabel: string;
  today: string;
  headers: string[];
  rows: BulkRow[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.dni));
  const chosen = rows.filter((r) => selected.has(r.dni));
  const toggle = (dni: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(dni);
      else next.delete(dni);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(rows.map((r) => r.dni)) : new Set());

  const openDialog = () => {
    setOutcome(null);
    setDay(today);
    setText("");
    setOpen(true);
  };

  const save = () => {
    if (mode === "baja" && !text.trim()) {
      toast.error("Escribí el motivo de la baja.");
      return;
    }
    const dnis = chosen.map((r) => r.dni);
    start(async () => {
      const res = mode === "alta" ? await bulkEnrollAction(column, dnis, day, text) : await bulkWithdrawAction(column, dnis, day, text);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const result = { done: res.done, skipped: res.skipped };
      if (result.done) toast.success(bulkSummary(mode, result));
      setSelected(new Set());
      router.refresh();
      if (result.skipped.length) setOutcome(result);
      else setOpen(false);
    });
  };

  const Icon = mode === "alta" ? UserPlus : UserMinus;
  const verb = mode === "alta" ? "Dar de alta" : "Dar de baja";

  return (
    <div className="space-y-3">
      {canManage && selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card p-2 pl-4 shadow-sm">
          <span className="text-sm font-semibold text-foreground">{personas(selected.size)} {selected.size === 1 ? "elegida" : "elegidas"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="rounded-xl gap-1">
              <X className="h-4 w-4" aria-hidden /> Quitar la selección
            </Button>
            <Button type="button" size="sm" onClick={openDialog} variant={mode === "baja" ? "outline" : "default"} className="rounded-xl gap-1.5 font-bold">
              <Icon className="h-4 w-4" aria-hidden /> {verb} a {personas(selected.size)}
            </Button>
          </div>
        </div>
      )}

      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className="w-10">
                <span className="sr-only">Elegir</span>
                <Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label="Elegir todas las de esta página" />
              </TableHead>
            )}
            {headers.map((h) => (
              <TableHead key={h} className={h === "Alta" ? "text-right" : undefined}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.dni} className={cn(selected.has(r.dni) && "bg-primary/5")}>
              {canManage && (
                <TableCell className="w-10">
                  <Checkbox checked={selected.has(r.dni)} onCheckedChange={(on) => toggle(r.dni, on)} aria-label={`Elegir a ${r.nombre || `DNI ${r.dni}`}`} />
                </TableCell>
              )}
              {r.cells.map((c, i) => (
                <TableCell key={i} className={i === 0 ? "font-semibold" : headers[i] === "Alta" ? "text-right" : headers[i] === "DNI" ? "tabular-nums" : undefined}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{outcome ? "Resultado" : `${verb} a ${personas(chosen.length)} en ${programLabel}`}</DialogTitle>
            {!outcome && (
              <DialogDescription>
                {chosen.slice(0, 4).map((r) => r.nombre || `DNI ${r.dni}`).join(", ")}
                {chosen.length > 4 ? ` y ${personas(chosen.length - 4)} más` : ""}.
              </DialogDescription>
            )}
          </DialogHeader>
          {outcome ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">{bulkSummary(mode, outcome)}</p>
              <Skipped outcome={outcome} />
            </div>
          ) : (
            <MoveFields mode={mode} today={today} day={day} setDay={setDay} text={text} setText={setText} idPrefix={`bulk-${mode}`} />
          )}
          <DialogFooter className="gap-2">
            {outcome ? (
              <Button type="button" onClick={() => setOpen(false)}>Cerrar</Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
                <Button type="button" onClick={save} disabled={pending || !chosen.length} className="gap-2 font-bold">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {verb}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PreviewRow = { dni: string; nombre: string | null; estado: "ok" | "ya-esta" | "no-encontrada" | "marcada"; detalle: string };

const ESTADO_TONE: Record<PreviewRow["estado"], string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  "ya-esta": "text-muted-foreground",
  "no-encontrada": "text-destructive",
  marcada: "text-muted-foreground",
};

/** "Alta de varias personas": se pegan los DNI (de una planilla, por ejemplo), se revisan y se dan las altas. */
export function PasteDnisEnrollDialog({ column, programLabel, today }: { column: string; programLabel: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; invalid: string[]; tooMany: boolean } | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toEnroll = useMemo(() => (preview?.rows ?? []).filter((r) => r.estado === "ok"), [preview]);

  const reset = () => {
    setRaw("");
    setPreview(null);
    setDay(today);
    setNote("");
    setOutcome(null);
  };

  const review = () =>
    start(async () => {
      const res = await previewBulkEnrollAction(column, raw);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setPreview({ rows: res.rows, invalid: res.invalid, tooMany: res.tooMany });
    });

  const save = () =>
    start(async () => {
      const res = await bulkEnrollAction(column, toEnroll.map((r) => r.dni), day, note);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const result = { done: res.done, skipped: res.skipped };
      if (result.done) toast.success(bulkSummary("alta", result));
      router.refresh();
      if (result.skipped.length) setOutcome(result);
      else {
        setOpen(false);
        reset();
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-xl font-bold gap-1.5">
          <ClipboardList className="h-4 w-4" aria-hidden /> Alta de varias personas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{outcome ? "Resultado" : `Alta de varias personas en ${programLabel}`}</DialogTitle>
          {!outcome && (
            <DialogDescription>
              {preview
                ? "Revisá la lista. Se da el alta solo a las que dicen “Se da de alta”."
                : `Pegá los DNI, uno por renglón o separados por comas (se pueden copiar de una columna de una planilla). Hasta ${BULK_MAX} por vez.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {outcome ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{bulkSummary("alta", outcome)}</p>
            <Skipped outcome={outcome} />
          </div>
        ) : !preview ? (
          <div className="space-y-1.5">
            <Label htmlFor="pegar-dnis">DNI de las personas<RequiredMark /></Label>
            <Textarea id="pegar-dnis" value={raw} onChange={(e) => setRaw(e.target.value)} rows={7} placeholder={"30123456\n28.456.789\n…"} className="rounded-xl font-mono text-sm" />
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="max-h-64 divide-y divide-border/40 overflow-y-auto rounded-xl border border-border/60 text-sm">
              {preview.rows.map((r) => (
                <li key={r.dni} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-foreground">{r.nombre || "Sin nombre"}</span>{" "}
                    <span className="tabular-nums text-muted-foreground">{r.dni}</span>
                  </span>
                  <span className={cn("text-xs font-semibold", ESTADO_TONE[r.estado])}>{r.detalle}</span>
                </li>
              ))}
            </ul>
            {(preview.invalid.length > 0 || preview.tooMany) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {preview.tooMany && <p>Había más de {BULK_MAX} DNI: se revisaron los primeros {BULK_MAX}. Los demás, en otra tanda.</p>}
                {preview.invalid.length > 0 && <p>Esto no parece un DNI y se dejó afuera: {preview.invalid.join(", ")}.</p>}
              </div>
            )}
            {toEnroll.length > 0 ? (
              <MoveFields mode="alta" today={today} day={day} setDay={setDay} text={note} setText={setNote} idPrefix="pegar-alta" />
            ) : (
              <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">No queda nadie a quien darle el alta.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {outcome ? (
            <Button type="button" onClick={() => { setOpen(false); reset(); }}>Cerrar</Button>
          ) : !preview ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
              <Button type="button" onClick={review} disabled={pending || !raw.trim()} className="gap-2 font-bold">
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Revisar la lista
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setPreview(null)} disabled={pending}>Volver a la lista</Button>
              <Button type="button" onClick={save} disabled={pending || !toEnroll.length} className="gap-2 font-bold">
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Dar de alta a {personas(toEnroll.length)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
