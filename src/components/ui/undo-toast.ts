"use client";

import { toast } from "sonner";
import { UNDO_TOAST_MS } from "@/lib/undo";

type UndoResult = { success: boolean; error?: string } | null | undefined;

/**
 * Aviso de "listo" con un botón "Deshacer" que se ve unos segundos (idea 141).
 * `undo` vuelve atrás en el servidor; `after` actualiza la pantalla si salió bien.
 */
export function toastWithUndo(message: string, undo: () => Promise<UndoResult>, after?: () => void) {
  toast.success(message, {
    duration: UNDO_TOAST_MS,
    action: {
      label: "Deshacer",
      onClick: async () => {
        const id = toast.loading("Deshaciendo…");
        const res = await undo().catch(() => null);
        if (res?.success) {
          toast.success("Listo, quedó como estaba.", { id });
          after?.();
        } else {
          toast.error(res?.error || "No se pudo deshacer. Probá de nuevo.", { id });
        }
      },
    },
  });
}
