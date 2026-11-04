"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { WEEK_DAYS, WEEK_LETTERS, parseSchedule, scheduleText } from "@/lib/hr-form";

// El horario del agente con días y horas ("Lunes a viernes, de 8 a 14 h"). Si el horario es raro
// (turnos rotativos, guardias), se puede escribir a mano. Lo que se guarda va en el campo oculto "schedule".

export function SchedulePicker({ defaultValue }: { defaultValue?: string | null }) {
  const parsed = parseSchedule(defaultValue);
  const startFree = Boolean(defaultValue && !parsed);
  const [free, setFree] = useState(startFree);
  const [freeText, setFreeText] = useState(startFree ? defaultValue ?? "" : "");
  const [days, setDays] = useState<number[]>(parsed?.days ?? (defaultValue ? [] : [0, 1, 2, 3, 4]));
  const [from, setFrom] = useState(parsed?.from ?? "08:00");
  const [to, setTo] = useState(parsed?.to ?? "14:00");

  const toggle = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const built = to > from ? scheduleText({ days, from, to }) : "";
  const value = free ? freeText.trim() : built;

  return (
    <div className="space-y-3">
      <input type="hidden" name="schedule" value={value} />
      {free ? (
        <Input
          id="schedule"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Por ejemplo: guardias de 24 h cada 3 días"
          maxLength={120}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días que trabaja">
            {WEEK_LETTERS.map((letter, d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEK_DAYS[d]}
                  title={WEEK_DAYS[d]}
                  onClick={() => toggle(d)}
                  className={`h-9 w-9 rounded-full border text-sm font-bold transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Entra
              <Input type="time" step={1800} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Hora de entrada" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Sale
              <Input type="time" step={1800} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hora de salida" />
            </label>
          </div>
          <p className={`text-xs ${built ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>
            {built ? `Horario: ${built}.` : days.length === 0 ? "Elegí al menos un día." : "La salida tiene que ser después de la entrada."}
          </p>
        </>
      )}
      <button type="button" onClick={() => setFree((f) => !f)} className="text-xs font-semibold text-primary hover:underline">
        {free ? "Elegir días y horas" : "Otro tipo de horario (escribirlo a mano)"}
      </button>
    </div>
  );
}
