import { cn } from "@/lib/utils"

/** Bloque gris de las pantallas de carga, con un brillo que lo recorre. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md bg-muted-foreground/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
