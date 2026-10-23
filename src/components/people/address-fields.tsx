"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddressOptions } from "@/lib/localidades";

export interface AddressValue {
  direccion: string;
  barrio: string;
  localidad: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  options: AddressOptions;
  /** Para que los ids no se repitan si hay dos formularios en la misma pantalla. */
  idPrefix?: string;
  inputClassName?: string;
  /** Por defecto, chicas como en "Editar datos". */
  labelClassName?: string;
}

/** Calle y altura, localidad y barrio en campos separados, como en el padrón. Localidad y barrio se eligen de una lista o se escriben. */
export function AddressFields({ value, onChange, options, idPrefix = "addr", inputClassName, labelClassName = "text-xs font-bold text-muted-foreground" }: AddressFieldsProps) {
  const set = (k: keyof AddressValue) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-direccion`} className={labelClassName}>Calle y altura</Label>
        <Input
          id={`${idPrefix}-direccion`}
          name="direccion"
          value={value.direccion}
          onChange={set("direccion")}
          placeholder="Ej.: Av. San Martín 2450, piso 1 B"
          autoComplete="off"
          className={inputClassName}
        />
        <p className="text-xs text-muted-foreground">Con la altura, la app la puede ubicar en el mapa.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-localidad`} className={labelClassName}>Localidad</Label>
          <Input
            id={`${idPrefix}-localidad`}
            name="localidad"
            list={`${idPrefix}-localidades`}
            value={value.localidad}
            onChange={set("localidad")}
            placeholder="Elegí o escribí"
            autoComplete="off"
            className={inputClassName}
          />
          <datalist id={`${idPrefix}-localidades`}>
            {options.localidades.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-barrio`} className={labelClassName}>Barrio</Label>
          <Input
            id={`${idPrefix}-barrio`}
            name="barrio"
            list={`${idPrefix}-barrios`}
            value={value.barrio}
            onChange={set("barrio")}
            placeholder="Elegí o escribí"
            autoComplete="off"
            className={inputClassName}
          />
          <datalist id={`${idPrefix}-barrios`}>
            {options.barrios.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>
      </div>
    </div>
  );
}
