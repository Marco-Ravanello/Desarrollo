// Pestañas con los colores institucionales: fondo celeste, la elegida en blanco con texto azul.
// Las usan las pestañas de Radix (components/ui/tabs.tsx) y las pestañas hechas con enlaces.

export const TAB_LIST_CLASS =
  "rounded-2xl border border-primary/10 bg-secondary/70 p-1 text-secondary-foreground/80 dark:bg-secondary/60 dark:text-secondary-foreground/75";

const TAB_BASE = "inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors";

/** Clase de una pestaña hecha con un enlace (aria-current="page" en la elegida). */
export function tabLinkClass(active: boolean): string {
  return `${TAB_BASE} ${
    active
      ? "bg-card text-primary shadow-sm ring-1 ring-primary/10"
      : "hover:bg-card/60 hover:text-primary"
  }`;
}
