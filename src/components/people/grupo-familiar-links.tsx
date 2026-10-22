"use client";

import { useRouter } from "next/navigation";
import { GrupoFamiliarView } from "@/components/people/grupo-familiar";
import type { GrupoFamiliar } from "@/services/ficha-social";

/** Grupo familiar en la ficha de la persona: tocar a un familiar abre su ficha. */
export function GrupoFamiliarLinks({ grupo }: { grupo: GrupoFamiliar }) {
  const router = useRouter();
  return <GrupoFamiliarView grupo={grupo} onOpen={(dni) => router.push(`/people/${encodeURIComponent(dni)}`)} />;
}
