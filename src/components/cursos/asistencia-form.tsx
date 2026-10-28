"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ASISTENCIA_ESTADOS, CURSO_LIMITS, type AsistenciaEstado } from "@/lib/cursos";
import { guardarAsistenciaAction } from "@/app/(dashboard)/cursos/actions";

type Fila = { inscriptoId: string; dni: string; nombre: string | null; estado: string | null; dejo: boolean };

const TONE: Record<AsistenciaEstado, string> = {
  PRESENTE: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  AUSENTE: "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500",
  AVISO: "border-amber-500 bg-amber-500 text-white",
};

/**
 * La lista de la clase para marcar en el celular: un toque por persona y "Guardar" abajo.
 * A quien no se marque se lo anota ausente al guardar.
 */
export function AsistenciaForm({
  cursoId,
  claseId,
  lista,
  tema: temaInicial,
  readOnly,
}: {
  cursoId: string;
  claseId: string;
  lista: Fila[];
  tema: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [marcas, setMarcas] = useState<Record<string, AsistenciaEstado>>(() =>
    Object.fromEntries(lista.filter((f) => f.estado).map((f) => [f.inscriptoId, f.estado as AsistenciaEstado]))
  );
  const [tema, setTema] = useState(temaInicial ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Si se suma alguien (inscripto desde esta pantalla), aparece sin marcar; lo ya marcado no se pierde.
  const ids = useMemo(() => new Set(lista.map((f) => f.inscriptoId)), [lista]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mark = (id: string, estado: AsistenciaEstado) => {
    setMarcas((m) => ({ ...m, [id]: estado }));
    setDirty(true);
  };
  const activos = lista.filter((f) => !f.dejo || marcas[f.inscriptoId]);
  const sinMarcar = activos.filter((f) => !marcas[f.inscriptoId]).length;
  const presentes = activos.filter((f) => marcas[f.inscriptoId] === "PRESENTE").length;

  const todosPresentes = () => {
    setMarcas((m) => {
      const next = { ...m };
      for (const f of activos) if (!next[f.inscriptoId]) next[f.inscriptoId] = "PRESENTE";
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(marcas).filter(([id]) => ids.has(id)));
    const res = await guardarAsistenciaAction(cursoId, claseId, payload, tema).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    const r = res as unknown as { presentes: number; ausentes: number; avisos: number };
    toast.success(`Asistencia guardada: ${r.presentes} presentes, ${r.ausentes} ausentes${r.avisos ? `, ${r.avisos} con aviso` : ""}.`);
    setDirty(false);
    router.refresh();
  };

  if (!activos.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">Todavía no hay nadie inscripto para este día.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`tema-${claseId}`}>Tema de la clase (opcional)</Label>
        <Input
          id={`tema-${claseId}`}
          value={tema}
          disabled={readOnly}
          maxLength={CURSO_LIMITS.tema}
          onChange={(e) => {
            setTema(e.target.value);
            setDirty(true);
          }}
          placeholder="Por ejemplo: instalación de un tomacorriente"
          className="h-11 rounded-xl"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-bold text-foreground">{presentes}</span> presentes de {activos.length}
          {sinMarcar > 0 && !readOnly && <> · {sinMarcar} sin marcar</>}
        </p>
        {!readOnly && sinMarcar > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={todosPresentes} className="h-9 rounded-xl text-xs font-bold gap-1.5">
            <CheckCheck className="h-4 w-4" /> Marcar el resto presentes
          </Button>
        )}
      </div>

      <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {activos.map((f) => {
          const actual = marcas[f.inscriptoId];
          return (
            <li key={f.inscriptoId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{f.nombre || "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground">DNI {f.dni}{f.dejo ? " · dejó el curso" : ""}</p>
              </div>
              <div role="radiogroup" aria-label={`Asistencia de ${f.nombre || f.dni}`} className="grid shrink-0 grid-cols-3 gap-1.5 sm:flex">
                {ASISTENCIA_ESTADOS.map((e) => {
                  const on = actual === e.key;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={readOnly}
                      onClick={() => mark(f.inscriptoId, e.key)}
                      className={cn(
                        "h-11 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed sm:min-w-[5.5rem]",
                        on ? TONE[e.key] : "border-border bg-background text-foreground hover:bg-muted disabled:opacity-60"
                      )}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <div className="sticky bottom-3 z-10 flex flex-col items-stretch gap-1 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {sinMarcar > 0 ? `${sinMarcar === 1 ? "Quien no marques queda" : `Los ${sinMarcar} que no marques quedan`} como ausente.` : dirty ? "Hay cambios sin guardar." : "Todo guardado."}
          </p>
          <Button onClick={save} disabled={saving} className="h-12 rounded-xl px-6 font-bold gap-2 sm:h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar asistencia
          </Button>
        </div>
      )}
    </div>
  );
}
