import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSafeAppLink, type AnswerStat } from "@/lib/assistant-text";

export type AssistantStat = AnswerStat;

const COLS: Record<number, string> = { 1: "grid-cols-1 sm:max-w-[14rem]", 2: "grid-cols-2 sm:max-w-md", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };

/** Los números importantes de una respuesta, grandes y arriba, como las tarjetas del Inicio. */
export function AssistantStats({ stats }: { stats: AssistantStat[] }) {
  const list = stats.slice(0, 4);
  if (!list.length) return null;
  return (
    <div className={cn("my-3 grid gap-2", COLS[list.length])}>
      {list.map((s, i) => {
        const attention = s.tone === "attention";
        const body = (
          <>
            <span className="block text-xs font-medium leading-tight text-muted-foreground">{s.label}</span>
            <span
              className={cn(
                "mt-1 block font-heading text-2xl font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]",
                attention ? "text-[#C2410C] dark:text-muni-orange" : "text-[#163C68] dark:text-blue-100"
              )}
            >
              {s.value}
            </span>
          </>
        );
        const box = "min-w-0 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-xs";
        return s.href && isSafeAppLink(s.href) ? (
          <Link
            key={i}
            href={s.href}
            aria-label={`${s.label}: ${s.value}. Ver listado`}
            className={cn(box, "group relative transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
          >
            {body}
            <ArrowUpRight className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary" aria-hidden />
          </Link>
        ) : (
          <div key={i} className={box}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
