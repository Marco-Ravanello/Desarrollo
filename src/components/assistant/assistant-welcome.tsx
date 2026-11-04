import { ArrowUpRight, BriefcaseBusiness, Car, FileText, GraduationCap, MapPinned, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import { ASSISTANT_TOPICS, type SuggestionTopic } from "@/lib/assistant-suggestions";

const ICONS: Record<SuggestionTopic["id"], LucideIcon> = {
  expedientes: FileText,
  personas: MapPinned,
  rrhh: BriefcaseBusiness,
  compras: ShoppingCart,
  vehiculos: Car,
  cursos: GraduationCap,
};

/** La bienvenida del asistente: qué puede contestar, con preguntas de ejemplo por tema. */
export function AssistantWelcome({ onAsk, disabled }: { onAsk: (question: string) => void; disabled?: boolean }) {
  return (
    <div className="py-4 sm:py-8">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
          <Sparkles className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">¿Qué querés saber?</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Preguntame con tus palabras por los datos de la Secretaría. Te respondo con números, tablas y gráficos.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ASSISTANT_TOPICS.map((topic) => {
          const Icon = ICONS[topic.id];
          return (
            <section key={topic.id} className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
              <h3 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                {topic.title}
              </h3>
              <ul className="space-y-0.5">
                {topic.questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onAsk(q)}
                      className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/85 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <span className="flex-1">{q}</span>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
