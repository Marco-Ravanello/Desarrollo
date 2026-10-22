"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import {
  PADRON_FIELDS,
  PADRON_IMPORT_CHUNK,
  buildPadronRecords,
  findHeaderRow,
  formatSheetDate,
  guessMapping,
  type ColumnMapping,
  type PadronField,
  type RowProblem,
} from "@/lib/padron-import";
import { importPadronChunkAction, previewPadronImportAction } from "@/app/(dashboard)/people/actions/padron-import-actions";
import type { PadronImportCounts } from "@/services/padron-import";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type Workbook = { fileName: string; sheets: string[]; matrices: Record<string, unknown[][]> };
type Summary = { counts: PadronImportCounts; errors: RowProblem[] };

const emptyCounts = (): PadronImportCounts => ({ created: 0, completed: 0, joined: 0, alreadyInProgram: 0 });

/** Lee un Excel o un CSV (en UTF-8 o en el formato de Excel en castellano) como filas y columnas. */
async function readWorkbook(file: File): Promise<Workbook> {
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    // raw: los DNI y las fechas quedan como texto, tal cual están en el archivo.
    wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true });
  } else {
    wb = XLSX.read(buffer, { type: "array" });
  }
  const matrices: Record<string, unknown[][]> = {};
  const sheets = wb.SheetNames.filter((name) => {
    const ws = wb.Sheets[name];
    if (!ws?.["!ref"]) return false;
    // range: 0 → la fila 1 de la planilla es la posición 0, así los números de fila coinciden.
    matrices[name] = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: true, range: 0 });
    return matrices[name].length > 0;
  });
  return { fileName: file.name, sheets, matrices };
}

function columnLetter(index: number) {
  return XLSX.utils.encode_col(index);
}

export function PadronImport() {
  const [program, setProgram] = useState("");
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [reading, setReading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  const matrix = useMemo(() => (workbook && sheet ? workbook.matrices[sheet] || [] : []), [workbook, sheet]);
  const headers = matrix[headerRow] || [];
  const width = Math.max(headers.length, ...matrix.slice(headerRow, headerRow + 20).map((r) => r.length));
  const sample = matrix.slice(headerRow + 1).find((r) => r.some((c) => String(c ?? "").trim() !== "")) || [];

  const built = useMemo(
    () => (matrix.length > 0 && mapping.dni !== undefined ? buildPadronRecords(matrix, headerRow, mapping) : null),
    [matrix, headerRow, mapping]
  );

  const programLabel = PADRON_PROGRAMS.find((p) => p.column === program)?.label;
  const hasName = mapping.nombreCompleto !== undefined || mapping.apellido !== undefined || mapping.nombre !== undefined;
  const busy = reading || checking || progress !== null;

  const resetReview = () => {
    setPreview(null);
    setResult(null);
  };

  const chooseSheet = (name: string, wb: Workbook | null = workbook) => {
    const m = wb?.matrices[name] || [];
    const row = findHeaderRow(m);
    setSheet(name);
    setHeaderRow(row);
    setMapping(guessMapping(m[row] || []));
    resetReview();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    resetReview();
    try {
      const wb = await readWorkbook(file);
      if (wb.sheets.length === 0) {
        toast.error("La planilla está vacía.");
        return;
      }
      setWorkbook(wb);
      chooseSheet(wb.sheets[0], wb);
    } catch {
      toast.error("No se pudo leer el archivo. Revisá que sea un Excel (.xlsx o .xls) o un CSV.");
    } finally {
      setReading(false);
    }
  };

  const setField = (field: PadronField, value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === "") delete next[field];
      else next[field] = Number(value);
      return next;
    });
    resetReview();
  };

  const chunks = () => {
    const records = built?.records || [];
    const out = [];
    for (let i = 0; i < records.length; i += PADRON_IMPORT_CHUNK) out.push(records.slice(i, i + PADRON_IMPORT_CHUNK));
    return out;
  };

  const handleCheck = async () => {
    if (!program || !built) return;
    setChecking(true);
    resetReview();
    try {
      const summary: Summary = { counts: emptyCounts(), errors: [] };
      for (const part of chunks()) {
        const res = await previewPadronImportAction(program, part);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        for (const k of Object.keys(summary.counts) as (keyof PadronImportCounts)[]) summary.counts[k] += res.counts[k];
        summary.errors.push(...res.errors);
      }
      setPreview(summary);
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    if (!program || !built || !workbook) return;
    const parts = chunks();
    const summary: Summary = { counts: emptyCounts(), errors: [] };
    setProgress(0);
    try {
      for (let i = 0; i < parts.length; i++) {
        const res = await importPadronChunkAction(program, parts[i], workbook.fileName, i + 1, parts.length);
        if (!res.success) {
          const saved = summary.counts.created + summary.counts.completed + summary.counts.joined;
          toast.error(saved > 0 ? `${res.error}. Lo anterior a la fila ${parts[i][0].row} ya se guardó.` : res.error);
          break;
        }
        for (const k of Object.keys(summary.counts) as (keyof PadronImportCounts)[]) summary.counts[k] += res.counts[k];
        summary.errors.push(...res.errors);
        setProgress(Math.round(((i + 1) / parts.length) * 100));
      }
      setResult(summary);
      setPreview(null);
      toast.success(`Importación terminada: ${summary.counts.created} personas nuevas y ${summary.counts.joined} sumadas a ${programLabel}.`);
    } finally {
      setProgress(null);
    }
  };

  const problems = [...(built?.errors || []), ...(result?.errors ?? preview?.errors ?? [])].sort((a, b) => a.row - b.row);
  const warnings = built?.warnings || [];
  const nothingToDo = preview && preview.counts.created + preview.counts.completed + preview.counts.joined === 0;

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        Suma personas de una planilla al padrón y las marca en un programa. A quien ya está en el padrón solo se le completan los
        datos vacíos: no se pisa nada de lo cargado.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="padron-program" className="text-xs font-bold">1. Programa</Label>
          <select
            id="padron-program"
            className={selectClass}
            value={program}
            disabled={busy}
            onChange={(e) => {
              setProgram(e.target.value);
              resetReview();
            }}
          >
            <option value="">Elegí el programa de la planilla</option>
            {PADRON_PROGRAMS.map((p) => (
              <option key={p.column} value={p.column}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">2. Planilla (Excel o CSV)</Label>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label="Planilla para importar al padrón"
              onChange={handleFile}
              disabled={busy}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <Button type="button" variant="outline" disabled={busy} className="w-full h-9 text-xs rounded-md">
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {workbook ? workbook.fileName : "Seleccionar archivo"}
            </Button>
          </div>
        </div>
      </div>

      {workbook && matrix.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-xs font-bold flex-1 min-w-[180px]">3. Qué columna es cada dato</p>
            {workbook.sheets.length > 1 && (
              <div className="space-y-1">
                <Label htmlFor="padron-sheet" className="text-xs text-muted-foreground font-bold">Hoja</Label>
                <select id="padron-sheet" className={selectClass} value={sheet} disabled={busy} onChange={(e) => chooseSheet(e.target.value)}>
                  {workbook.sheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="padron-header-row" className="text-xs text-muted-foreground font-bold">Encabezados en la fila</Label>
              <select
                id="padron-header-row"
                className={selectClass}
                value={headerRow}
                disabled={busy}
                onChange={(e) => {
                  const row = Number(e.target.value);
                  setHeaderRow(row);
                  setMapping(guessMapping(matrix[row] || []));
                  resetReview();
                }}
              >
                {matrix.slice(0, 15).map((_, i) => (
                  <option key={i} value={i}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border divide-y divide-border">
            {PADRON_FIELDS.map((field) => {
              const index = mapping[field.key];
              const raw = index !== undefined ? sample[index] : undefined;
              const example = field.key === "fechaNacimiento" ? formatSheetDate(raw) || "" : String(raw ?? "").trim();
              return (
                <div key={field.key} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-1.5 sm:gap-3 items-center px-3 py-2">
                  <div>
                    <Label htmlFor={`padron-col-${field.key}`} className="text-xs font-semibold">
                      {field.label}
                      {field.key === "dni" && <span className="text-destructive"> *</span>}
                    </Label>
                    {example && <p className="text-xs text-muted-foreground truncate">Ej.: {example}</p>}
                  </div>
                  <select
                    id={`padron-col-${field.key}`}
                    className={selectClass}
                    value={index ?? ""}
                    disabled={busy}
                    onChange={(e) => setField(field.key, e.target.value)}
                  >
                    <option value="">No está en la planilla</option>
                    {Array.from({ length: width }, (_, i) => (
                      <option key={i} value={i}>
                        {columnLetter(i)}: {String(headers[i] ?? "").trim() || "(sin título)"}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {mapping.dni === undefined && (
            <p className="text-xs text-destructive">Elegí qué columna tiene el DNI.</p>
          )}
          {mapping.dni !== undefined && !hasName && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Sin una columna de nombre solo se pueden sumar personas que ya están en el padrón.
            </p>
          )}

          <Button
            type="button"
            onClick={handleCheck}
            disabled={busy || !program || !built || built.records.length === 0}
            className="w-full rounded-xl"
          >
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            {!program ? "Elegí el programa para revisar" : `Revisar ${built?.records.length ?? 0} filas con DNI`}
          </Button>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <p className="text-xs font-bold">4. Antes de guardar</p>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            <li className="rounded-xl bg-muted/50 p-3"><span className="block text-lg font-bold">{preview.counts.created}</span>personas nuevas en el padrón</li>
            <li className="rounded-xl bg-muted/50 p-3"><span className="block text-lg font-bold">{preview.counts.completed}</span>ya estaban y se completan datos vacíos</li>
            <li className="rounded-xl bg-muted/50 p-3"><span className="block text-lg font-bold">{preview.counts.joined}</span>se suman a {programLabel}</li>
            <li className="rounded-xl bg-muted/50 p-3"><span className="block text-lg font-bold">{preview.counts.alreadyInProgram}</span>ya figuraban en el programa</li>
          </ul>
          <Button type="button" onClick={handleImport} disabled={busy || Boolean(nothingToDo)} className="w-full rounded-xl">
            {progress !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {nothingToDo ? "No hay nada para importar" : "Importar al padrón"}
          </Button>
        </div>
      )}

      {progress !== null && <Progress value={progress} aria-label="Avance de la importación" />}

      {result && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 rounded-2xl">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-200 font-bold">Importación terminada</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            {result.counts.created} personas nuevas, {result.counts.completed} con datos completados y {result.counts.joined} sumadas a {programLabel}.
          </AlertDescription>
        </Alert>
      )}

      {(problems.length > 0 || warnings.length > 0) && (preview || result || built) && (
        <Alert variant={problems.length > 0 ? "destructive" : "default"} className="rounded-2xl">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold">
            {problems.length > 0 ? `Filas que no se van a cargar (${problems.length + warnings.length})` : `Avisos (${warnings.length})`}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 text-sm max-h-40 overflow-y-auto">
              {problems.map((p, idx) => (
                <li key={`e${idx}`}>Fila {p.row}: {p.message}.</li>
              ))}
              {warnings.map((w, idx) => (
                <li key={`w${idx}`}>Fila {w.row}: {w.message}.</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
