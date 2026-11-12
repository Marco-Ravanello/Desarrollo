"use client";

import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FolderPlus, MessageCircle, Phone, UserRound } from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TABLE_ROW_CLASS } from "@/components/ui/table";
import { copyText } from "@/components/ui/copy-text";
import { whatsappHref, whatsappNumbers } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/** Fila del Registro Único con menú del botón derecho (idea 154): ficha, otra pestaña, nuevo expediente, copiar y WhatsApp. */
export function PersonRowMenu({
  href,
  name,
  dni,
  phone,
  canCreateCase,
  className,
  children,
}: {
  href: string;
  name: string;
  dni: string;
  phone: string | null;
  canCreateCase: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const wa = whatsappNumbers(phone)[0] ?? null;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr className={cn(TABLE_ROW_CLASS, "data-[state=open]:bg-muted/60", className)} data-row-menu="persona">
          {children}
        </tr>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Acciones de ${name}`}>
        <ContextMenuLabel>{name}</ContextMenuLabel>
        <ContextMenuItem onSelect={() => router.push(href)}>
          <UserRound /> Ver ficha
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open(href, "_blank", "noopener")}>
          <ExternalLink /> Abrir en otra pestaña
        </ContextMenuItem>
        {canCreateCase && (
          <ContextMenuItem onSelect={() => router.push(`/cases/new?dni=${encodeURIComponent(dni)}`)}>
            <FolderPlus /> Nuevo expediente
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copyText(dni, "DNI copiado.")}>
          <Copy /> Copiar DNI
        </ContextMenuItem>
        {phone && (
          <ContextMenuItem onSelect={() => copyText(phone, "Teléfono copiado.")}>
            <Phone /> Copiar teléfono
          </ContextMenuItem>
        )}
        {wa && (
          <ContextMenuItem onSelect={() => window.open(whatsappHref(wa), "_blank", "noopener")}>
            <MessageCircle /> Escribir por WhatsApp
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
