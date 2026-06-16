"use client";

import {
  MoreHorizontal, Eye, Edit, UserMinus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ViewHRDetail } from "./view-hr-detail";
import { DeleteHRAction, EditHRAction } from "./actions-client";

interface AgentActionsMenuProps {
  agent: any;
}

export function AgentActionsMenu({ agent }: AgentActionsMenuProps) {
  return (
    <Sheet>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary hover:text-white transition-all">
             <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/50">
          <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Opciones de Legajo</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />

          <SheetTrigger asChild>
            <DropdownMenuItem
              className="rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <Eye className="h-4 w-4" /> Ver Detalles
            </DropdownMenuItem>
          </SheetTrigger>

          <EditHRAction />

          <DropdownMenuSeparator className="bg-border/50" />

          <DeleteHRAction agentId={agent.id} />
        </DropdownMenuContent>
      </DropdownMenu>

      <SheetContent side="right" className="sm:max-w-lg w-full border-l border-border bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-2xl font-black">Detalle del Agente</SheetTitle>
          <SheetDescription className="text-base">Información completa y situación de revista.</SheetDescription>
        </SheetHeader>
        <ViewHRDetail agent={agent} />
      </SheetContent>
    </Sheet>
  );
}
