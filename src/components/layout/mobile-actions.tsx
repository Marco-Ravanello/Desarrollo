"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Botones de una página: en la compu, uno al lado del otro; en el celular, un solo botón
 * "Acciones" que abre un panel desde abajo con los mismos botones, uno debajo del otro.
 */
export function MobileActions({ children, title = "Acciones" }: { children: React.ReactNode; title?: string }) {
  if (React.Children.toArray(children).length === 0) return null;
  return (
    <>
      <div className="hidden md:contents">{children}</div>
      <div className="md:hidden w-full">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full rounded-xl font-bold gap-2">
              <MoreHorizontal className="h-4 w-4" /> {title}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription className="sr-only">Lo que se puede hacer en esta página.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2 [&_button]:w-full [&_button]:justify-center">{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
