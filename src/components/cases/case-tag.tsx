/** Etiqueta corta delante de la carátula ("Tormenta"), en lugar del prefijo entre corchetes. */
export function CaseTag({ tag }: { tag: string | null | undefined }) {
  if (!tag) return null;
  return (
    <span className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-xs font-bold text-sky-800 dark:text-sky-300">
      {tag}
    </span>
  );
}
