"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatMoneyTyping, moneyFromNumber, moneyToPlain } from "@/lib/money-input";

/** Un importe en pesos que muestra los puntos de miles mientras se escribe. Lo que se manda va en el campo oculto `name`. */
export function MoneyInput({
  id,
  name,
  defaultValue,
  placeholder,
}: {
  id?: string;
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
}) {
  const [shown, setShown] = useState(() => moneyFromNumber(defaultValue));
  return (
    <>
      <input type="hidden" name={name} value={moneyToPlain(shown)} />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          onChange={(e) => setShown(formatMoneyTyping(e.target.value))}
          placeholder={placeholder}
          className="pl-7 tabular-nums"
        />
      </div>
    </>
  );
}
