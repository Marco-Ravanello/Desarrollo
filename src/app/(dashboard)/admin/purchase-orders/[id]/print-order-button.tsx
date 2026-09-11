"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintOrderButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest px-6 rounded-xl flex items-center gap-2"
    >
      <Printer className="h-4 w-4" />
      Exportar PDF / Imprimir
    </Button>
  );
}
