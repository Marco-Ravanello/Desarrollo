"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { BreadcrumbsProvider } from "@/components/layout/breadcrumbs-context";

/** La sesión llega ya leída del servidor: así el menú y el usuario aparecen completos desde el primer momento. */
export function Providers({ children, session }: { children: React.ReactNode; session?: Session | null }) {
  return (
    <SessionProvider session={session}>
      <BreadcrumbsProvider>
        {children}
      </BreadcrumbsProvider>
    </SessionProvider>
  );
}
