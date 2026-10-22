"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const TabContext = createContext<(tab: string) => void>(() => {});

/** Pestañas de la ficha de la persona; la pestaña elegida queda en la dirección (?tab=) para volver a ella. */
export function PersonTabs({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
  const [tab, setTab] = useState(defaultTab);
  const pathname = usePathname();

  // replaceState (y no router.replace) para no volver a pedir la página al servidor en cada pestaña.
  const change = (value: string) => {
    setTab(value);
    window.history.replaceState(null, "", value === "datos" ? pathname : `${pathname}?tab=${value}`);
  };

  return (
    <TabContext.Provider value={change}>
      <Tabs value={tab} onValueChange={change}>
        {children}
      </Tabs>
    </TabContext.Provider>
  );
}

/** Cifra del resumen que lleva a su pestaña. */
export function TabShortcut({ tab, value, label }: { tab: string; value: number; label: string }) {
  const goTo = useContext(TabContext);
  return (
    <button
      type="button"
      onClick={() => goTo(tab)}
      className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-left transition-colors hover:border-primary/40"
    >
      <span className="block text-2xl font-bold text-foreground">{value.toLocaleString("es-AR")}</span>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
