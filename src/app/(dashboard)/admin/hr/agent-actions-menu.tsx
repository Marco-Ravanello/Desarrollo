"use client";

import Link from "next/link";
import { MoreHorizontal, Eye, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DeleteHRAction } from "./actions-client";

/** El menú de cada fila de Recursos Humanos: ver el legajo y editarlo (cada uno en su página) y dar de baja. */
export function AgentActionsMenu({ agentId, canEdit }: { agentId: string; canEdit: boolean }) {
  const item = "rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Acciones del agente" className="rounded-xl hover:bg-primary hover:text-white transition-all">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/50">
        <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-muted-foreground">Opciones de legajo</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem asChild className={item}>
          <Link href={`/admin/hr/${agentId}`}>
            <Eye className="h-4 w-4" /> Ver legajo
          </Link>
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuItem asChild className={item}>
              <Link href={`/admin/hr/${agentId}/editar`}>
                <Edit className="h-4 w-4" /> Editar legajo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DeleteHRAction agentId={agentId} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
