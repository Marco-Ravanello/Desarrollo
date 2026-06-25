"use client";

import { useState } from "react";
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
import { DeleteHRAction } from "./actions-client";
import { EditHRForm } from "./edit-hr-form";

interface AgentActionsMenuProps {
  agent: any;
  areas: any[];
}

export function AgentActionsMenu({ agent, areas }: AgentActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 500);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary hover:text-white transition-all">
             <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/50">
          <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Opciones de Legajo</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem
            className="rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              setMode('view');
              setOpen(true);
            }}
          >
            <Eye className="h-4 w-4" /> Ver Detalles
          </DropdownMenuItem>

          <DropdownMenuItem
            className="rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              setMode('edit');
              setOpen(true);
            }}
          >
            <Edit className="h-4 w-4" /> Editar Legajo
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/50" />

          <DeleteHRAction agentId={agent.id} />
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg w-full border-l border-border bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-2xl font-black">
            {mode === 'view' ? 'Detalle del Agente' : 'Editar Legajo'}
          </SheetTitle>
          <SheetDescription className="text-base">
            {mode === 'view'
              ? 'Información completa y situación de revista.'
              : 'Actualice los datos del agente municipal.'}
          </SheetDescription>
        </SheetHeader>

        {mode === 'view' ? (
          <ViewHRDetail agent={agent} />
        ) : (
          <EditHRForm agent={agent} areas={areas} onComplete={() => setOpen(false)} />
        )}
      </SheetContent>
      </Sheet>
    </>
  );
}
