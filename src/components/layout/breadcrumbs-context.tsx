"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface BreadcrumbsContextType {
  customItems: BreadcrumbItem[] | null;
  setCustomItems: (items: BreadcrumbItem[] | null) => void;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextType>({
  customItems: null,
  setCustomItems: () => {}
});

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [customItems, setCustomItems] = useState<BreadcrumbItem[] | null>(null);

  return (
    <BreadcrumbsContext.Provider value={{ customItems, setCustomItems }}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(BreadcrumbsContext);
}

export function PageBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { setCustomItems } = useBreadcrumbs();

  useEffect(() => {
    setCustomItems(items);
    return () => {
      setCustomItems(null);
    };
  }, [items, setCustomItems]);

  return null;
}
