"use client";

import { SessionProvider } from "next-auth/react";
import { BreadcrumbsProvider } from "@/components/layout/breadcrumbs-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BreadcrumbsProvider>
        {children}
      </BreadcrumbsProvider>
    </SessionProvider>
  );
}
