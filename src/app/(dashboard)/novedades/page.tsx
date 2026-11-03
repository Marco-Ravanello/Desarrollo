import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { NOVEDADES, claveNovedad, fechaNovedad } from "@/lib/novedades";

export const metadata = { title: "Novedades" };

/** Lo que fue cambiando en la app, de lo más nuevo a lo más viejo. */
export default function NovedadesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Novedades" description="Lo que fue cambiando en la app, de lo más nuevo a lo más viejo." icon={Sparkles} />
      <ol className="relative max-w-3xl space-y-6 border-l-2 border-border/70 pl-6">
        {NOVEDADES.map((n) => (
          <li key={claveNovedad(n)} className="relative">
            <span className="absolute -left-[33px] top-5 h-4 w-4 rounded-full border-[3px] border-background bg-muni-orange" aria-hidden />
            <Card className="rounded-2xl border-border/60 p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">{fechaNovedad(n.fecha)}</p>
              <h2 className="mt-0.5 font-heading text-lg font-bold text-foreground">{n.titulo}</h2>
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {n.cambios.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#163C68] dark:bg-blue-300" aria-hidden />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
