import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/** Renglón "Filtros puestos" con cada filtro y un enlace para quitarlos todos. No se muestra si no hay ninguno. */
export function ActiveFilters({
  items,
  clearHref,
  className,
}: {
  items: (string | false | null | undefined)[];
  clearHref: string;
  className?: string;
}) {
  const puestos = items.filter((i): i is string => Boolean(i));
  if (puestos.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 text-xs ${className ?? "mt-3"}`}>
      <span className="font-semibold text-muted-foreground">Filtros puestos:</span>
      {puestos.map((p) => (
        <Badge key={p} variant="secondary" className="text-xs font-medium">
          {p}
        </Badge>
      ))}
      <Link href={clearHref} className="ml-1 font-semibold text-primary hover:underline">
        Quitar filtros
      </Link>
    </div>
  );
}
