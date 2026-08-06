"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ComboboxProps {
  options: { value: string; label: string }[];
  placeholder?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}

export function Combobox({ options, placeholder = "Seleccionar...", name, value: propsValue, defaultValue, onValueChange, required }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");
  const value = propsValue !== undefined ? propsValue : internalValue;
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <div className="relative w-full">
      <input type="hidden" name={name} value={value} required={required} />
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground shadow-md rounded-md border p-1 animate-in fade-in zoom-in-95">
          <div className="flex items-center border-b px-2 pb-1 mb-1">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Buscar..."
              className="h-8 w-full border-none focus-visible:ring-0 px-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-2 px-4 text-sm text-slate-500">No se encontraron resultados.</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    const newValue = option.value === value ? "" : option.value;
                    if (propsValue === undefined) setInternalValue(newValue);
                    onValueChange?.(newValue);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
