"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { rememberRecent, type RecentKind } from "@/lib/recent-views";

/** Anota la visita para "Vistos recientemente" del buscador. No muestra nada. */
export function RememberVisit({ kind, id }: { kind: RecentKind; id: string }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  React.useEffect(() => {
    rememberRecent(userId, { kind, id });
  }, [userId, kind, id]);
  return null;
}
