"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Las acciones que no son la principal de una página, juntas en "Más acciones" (idea 109).
 * En la compu se abre un menú debajo del botón; en el celular, un panel desde abajo.
 *
 * Los botones de adentro suelen abrir su propio diálogo. Por eso el menú de la compu no se
 * desarma al cerrarse (solo se oculta): así el diálogo que se abrió sigue abierto.
 */
export function MoreActions({
  children,
  label = "Más acciones",
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  /** "band": sobre la banda azul de la ficha (botón con borde blanco). */
  tone?: "default" | "band";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || wrapRef.current?.contains(target)) return;
      // Un toque dentro del diálogo que se abrió desde el menú no lo cierra.
      if (target.closest?.('[role="dialog"], [role="alertdialog"]')) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (React.Children.toArray(children).length === 0) return null;

  const triggerClass =
    tone === "band"
      ? "h-9 gap-1.5 rounded-xl border-white/30 bg-white/10 text-xs font-bold text-white shadow-none hover:bg-white/20 hover:text-white dark:border-white/30 dark:bg-white/10"
      : "gap-1.5 rounded-xl font-bold";

  // Cada botón de adentro se ve como un renglón del menú.
  const itemsClass =
    "flex flex-col gap-0.5 [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start " +
    "[&_a]:h-10 [&_button]:h-10 [&_a]:rounded-xl [&_button]:rounded-xl [&_a]:border-0 [&_button]:border-0 " +
    "[&_a]:bg-transparent [&_button]:bg-transparent [&_a]:shadow-none [&_button]:shadow-none " +
    "[&_a]:px-3 [&_button]:px-3 [&_a]:text-sm [&_button]:text-sm [&_a]:font-semibold [&_button]:font-semibold " +
    "[&_a]:text-foreground [&_button]:text-foreground [&_a:hover]:bg-muted [&_button:hover]:bg-muted";

  return (
    <>
      <div ref={wrapRef} className={cn("relative hidden md:block", className)}>
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          size={tone === "band" ? "sm" : "default"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className={triggerClass}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden /> {label}
        </Button>
        <div
          id={menuId}
          role="group"
          aria-label={label}
          className={cn(
            "absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-xl",
            itemsClass,
            !open && "hidden"
          )}
          onClick={(e) => {
            // Al elegir una acción se cierra el menú (el diálogo, si abre uno, sigue abierto).
            if ((e.target as Element).closest("button, a")) setOpen(false);
          }}
        >
          {children}
        </div>
      </div>

      <div className={cn("md:hidden", tone === "default" && "w-full", className)}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size={tone === "band" ? "sm" : "default"} className={cn(triggerClass, tone === "default" && "w-full")}>
              <MoreHorizontal className="h-4 w-4" aria-hidden /> {label}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>{label}</SheetTitle>
              <SheetDescription className="sr-only">Lo que se puede hacer en esta página.</SheetDescription>
            </SheetHeader>
            <div className={cn("mt-3", itemsClass)}>{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
