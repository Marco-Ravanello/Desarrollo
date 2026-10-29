"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderOption } from "@/services/providers";

export interface PickedProvider {
  providerId: string;
  providerName: string;
  providerCuit: string;
}

const digits = (s: string) => s.replace(/[^0-9]/g, "");

/**
 * Proveedor de la orden: se busca por nombre o CUIT entre los dados de alta y completa los datos solo.
 * Si no está en la lista, se puede escribir a mano (como antes).
 */
export function ProviderPicker({
  providers,
  value,
  onChange,
  onPick,
}: {
  providers: ProviderOption[];
  value: PickedProvider;
  onChange: (next: PickedProvider) => void;
  /** Cuando se elige uno de la lista (para completar el N° de proveedor). */
  onPick?: (provider: ProviderOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);

  const selected = value.providerId ? providers.find((p) => p.id === value.providerId) : undefined;
  const typedByHand = !selected && (manual || Boolean(value.providerName || value.providerCuit));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers.slice(0, 8);
    const qDigits = digits(q);
    return providers
      .filter((p) => p.name.toLowerCase().includes(q) || (qDigits.length >= 2 && digits(p.cuit).includes(qDigits)))
      .slice(0, 8);
  }, [providers, query]);

  // Escrito a mano, pero con el CUIT de un proveedor que ya está dado de alta.
  const sameCuit = typedByHand && digits(value.providerCuit).length === 11
    ? providers.find((p) => digits(p.cuit) === digits(value.providerCuit))
    : undefined;

  const pick = (p: ProviderOption) => {
    onChange({ providerId: p.id, providerName: p.name, providerCuit: p.cuit });
    onPick?.(p);
    setManual(false);
    setOpen(false);
    setQuery("");
  };

  const hidden = (
    <>
      <input type="hidden" name="providerId" value={value.providerId} />
      {!typedByHand && (
        <>
          <input type="hidden" name="providerName" value={value.providerName} />
          <input type="hidden" name="providerCuit" value={value.providerCuit} />
        </>
      )}
    </>
  );

  if (selected) {
    return (
      <div className="space-y-2">
        <Label>Proveedor</Label>
        {hidden}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{selected.name}</div>
              <div className="text-xs text-muted-foreground">CUIT {selected.cuit}</div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => onChange({ providerId: "", providerName: "", providerCuit: "" })}
          >
            Cambiar
          </Button>
        </div>
      </div>
    );
  }

  if (typedByHand) {
    return (
      <div className="space-y-3">
        {hidden}
        <div className="flex items-center justify-between gap-2">
          <Label>Proveedor (escrito a mano)</Label>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              setManual(false);
              onChange({ providerId: "", providerName: "", providerCuit: "" });
            }}
          >
            Elegir de la lista
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="providerName" className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              id="providerName"
              name="providerName"
              placeholder="Ej: Duarte Fernando Gabriel"
              required
              value={value.providerName}
              onChange={(e) => onChange({ ...value, providerName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="providerCuit" className="text-xs text-muted-foreground">CUIT</Label>
            <Input
              id="providerCuit"
              name="providerCuit"
              placeholder="Ej: 23-25249967-9"
              value={value.providerCuit}
              onChange={(e) => onChange({ ...value, providerCuit: e.target.value })}
            />
          </div>
        </div>
        {sameCuit ? (
          <p className="text-xs text-muted-foreground">
            Ese CUIT es de <span className="font-semibold text-foreground">{sameCuit.name}</span>, que ya está en la lista.{" "}
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => pick(sameCuit)}>
              Usar ese proveedor
            </button>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            La orden queda con estos datos. Para que aparezca en la ficha del proveedor,{" "}
            <Link href="/admin/providers" className="font-semibold text-primary hover:underline" target="_blank">
              dalo de alta en Proveedores
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hidden}
      <Label htmlFor="providerSearch">Proveedor</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="providerSearch"
          role="combobox"
          aria-expanded={open}
          aria-controls="providerOptions"
          autoComplete="off"
          placeholder={providers.length ? "Buscá por nombre o CUIT" : "Todavía no hay proveedores dados de alta"}
          className="pl-9"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches.length === 1) pick(matches[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {open && (
          <ul
            id="providerOptions"
            role="listbox"
            className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-md"
          >
            {matches.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                >
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.cuit}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Ningún proveedor dado de alta coincide.</li>
            )}
            <li className="mt-1 border-t border-border/40 pt-1">
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setManual(true);
                  setOpen(false);
                  const q = query.trim();
                  // Lo que se buscó pasa al campo que corresponde.
                  onChange({ providerId: "", providerName: digits(q).length >= 8 ? "" : q, providerCuit: digits(q).length >= 8 ? q : "" });
                  setQuery("");
                }}
              >
                No está en la lista: escribirlo a mano
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
