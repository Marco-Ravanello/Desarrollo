"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";
import { ABRIR_NUEVA_INTERVENCION } from "@/lib/atajos";

/** Las pestañas del expediente. El botón "Nueva intervención" del encabezado vuelve a "Historia", donde está el formulario. */
export function CaseTabs({ children, className }: { children: ReactNode; className?: string }) {
  const [tab, setTab] = useState("historia");
  useEffect(() => {
    const open = () => setTab("historia");
    window.addEventListener(ABRIR_NUEVA_INTERVENCION, open);
    return () => window.removeEventListener(ABRIR_NUEVA_INTERVENCION, open);
  }, []);
  return (
    <Tabs value={tab} onValueChange={setTab} className={className}>
      {children}
    </Tabs>
  );
}
