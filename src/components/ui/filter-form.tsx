"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Formulario de filtros de las listas, igual en todas: lo que se elige en un desplegable o una casilla
 * se aplica enseguida; el texto se busca con Enter o con el botón Buscar. Los campos vacíos o en
 * "todos" no van a la dirección, y siempre se vuelve a la primera página. Cuando cambia la dirección
 * (por ejemplo con "Quitar filtros"), el formulario se arma de nuevo con lo que dice.
 */
export function FilterForm({
  children,
  className,
  ...rest
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "onChange" | "method">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      const v = String(value).trim();
      if (v && v !== "all") params.append(key, v);
    });
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <form
      key={searchParams.toString()}
      {...rest}
      role={rest.role ?? "search"}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox")) {
          apply(e.currentTarget);
        }
      }}
    >
      {children}
    </form>
  );
}
