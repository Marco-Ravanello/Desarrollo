"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkPlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTRO_NOMBRE_MAX, FILTROS_MAX, type FiltroGuardado } from "@/lib/filtros-guardados";
import { borrarFiltroAction, guardarFiltroAction } from "@/app/(dashboard)/cases/actions/filtros";

/**
 * "Mis filtros" de la lista de Expedientes: un toque abre la lista con esos filtros.
 * Con filtros puestos aparece "Guardar estos filtros".
 */
export function SavedFilters({ filtros, consultaActual }: { filtros: FiltroGuardado[]; consultaActual: string }) {
  const router = useRouter();
  const [nombrando, setNombrando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const yaGuardado = filtros.find((f) => f.consulta === consultaActual);

  if (filtros.length === 0 && !consultaActual) return null;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarFiltroAction(nombre, consultaActual).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success(`Guardado como "${nombre.trim()}".`);
    setNombrando(false);
    setNombre("");
    router.refresh();
  };

  const borrar = async (f: FiltroGuardado) => {
    const res = await borrarFiltroAction(f.nombre).catch(() => null);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo borrar. Probá de nuevo.");
    toast.success(`Se borró "${f.nombre}".`);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Mis filtros">
      {filtros.length > 0 && (
        <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" aria-hidden /> Mis filtros:
        </span>
      )}
      {filtros.map((f) => {
        const activo = f.consulta === consultaActual;
        return (
          <span
            key={f.nombre}
            className={`inline-flex items-center rounded-full border text-xs font-semibold ${
              activo ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-muted/30 text-foreground"
            }`}
          >
            <Link href={`/cases?${f.consulta}`} className="py-1 pl-3 pr-1.5 hover:underline" aria-current={activo ? "true" : undefined}>
              {f.nombre}
            </Link>
            <button
              type="button"
              onClick={() => borrar(f)}
              className={`mr-1 rounded-full p-0.5 ${activo ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <X className="h-3 w-3" aria-hidden />
              <span className="sr-only">Borrar el filtro {f.nombre}</span>
            </button>
          </span>
        );
      })}

      {consultaActual && !yaGuardado && !nombrando && filtros.length < FILTROS_MAX && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setNombrando(true)} className="h-7 gap-1 rounded-full px-2.5 text-xs font-bold text-primary">
          <BookmarkPlus className="h-3.5 w-3.5" /> Guardar estos filtros
        </Button>
      )}
      {nombrando && (
        <form onSubmit={guardar} className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={nombre}
            maxLength={FILTRO_NOMBRE_MAX}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre del filtro"
            placeholder="Por ejemplo: urgentes de mi área"
            className="h-8 w-56 rounded-xl text-xs"
          />
          <Button type="submit" size="sm" disabled={saving || !nombre.trim()} className="h-8 rounded-xl text-xs font-bold">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNombrando(false)} className="h-8 rounded-xl text-xs">
            Cancelar
          </Button>
        </form>
      )}
    </div>
  );
}
