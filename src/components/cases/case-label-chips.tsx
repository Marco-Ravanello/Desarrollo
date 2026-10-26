import Link from "next/link";
import { cn } from "@/lib/utils";
import { caseLabelName } from "@/lib/case-labels";

// Etiquetas del expediente como pastillas violetas (distintas del estado, la prioridad y "Tormenta").

const CHIP = "inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:text-violet-300";

/** Las etiquetas del expediente. Con `linkTo`, cada una lleva a la lista filtrada por ella. */
export function CaseLabelChips({
  labels,
  linkTo,
  max,
  className,
}: {
  labels: string[] | null | undefined;
  linkTo?: (key: string) => string;
  /** Cuántas mostrar antes de "+N". */
  max?: number;
  className?: string;
}) {
  const known = (labels ?? []).filter((k) => caseLabelName(k));
  if (!known.length) return null;
  const shown = max ? known.slice(0, max) : known;
  const rest = known.length - shown.length;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((k) =>
        linkTo ? (
          <Link key={k} href={linkTo(k)} className={cn(CHIP, "hover:bg-violet-500/20")}>
            {caseLabelName(k)}
          </Link>
        ) : (
          <span key={k} className={CHIP}>
            {caseLabelName(k)}
          </span>
        )
      )}
      {rest > 0 && <span className="text-xs font-semibold text-muted-foreground">+{rest}</span>}
    </span>
  );
}
