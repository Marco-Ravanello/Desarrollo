"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * La ficha que se abrió ya se unió con otra: se pasa a la que quedó. Se hace desde el navegador porque
 * la página de la ficha ya empezó a mostrarse (la pantalla de carga), y un desvío del servidor ahí falla.
 */
export function MergedRedirect({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const href = `/people/${encodeURIComponent(to)}?unida=${encodeURIComponent(from)}`;
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return (
    <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Esta ficha se unió con la del DNI {to}.{" "}
      <Link href={href} className="font-semibold text-primary hover:underline">
        Abrir la ficha
      </Link>
    </p>
  );
}
