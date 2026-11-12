import { describe, expect, it } from "vitest";
import { UNDO_TOAST_MS, UNDO_WINDOW_MS, UNDONE_ACTIONS, withinUndoWindow } from "@/lib/undo";
import { describeAuditAction } from "@/lib/audit-labels";

describe("deshacer (idea 141)", () => {
  const done = new Date("2026-11-12T16:00:00Z");
  const at = (ms: number) => new Date(done.getTime() + ms);

  it("el servidor acepta deshacer un rato más que lo que dura el aviso, pero no mucho más", () => {
    expect(UNDO_WINDOW_MS).toBeGreaterThan(UNDO_TOAST_MS);
    expect(withinUndoWindow(done, at(0))).toBe(true);
    expect(withinUndoWindow(done, at(UNDO_TOAST_MS))).toBe(true);
    expect(withinUndoWindow(done, at(UNDO_WINDOW_MS))).toBe(true);
    expect(withinUndoWindow(done, at(UNDO_WINDOW_MS + 1))).toBe(false);
    expect(withinUndoWindow(done, at(60 * 60 * 1000))).toBe(false);
  });

  it("tolera relojes un poco corridos, pero no fechas del futuro", () => {
    expect(withinUndoWindow(done, at(-2_000))).toBe(true);
    expect(withinUndoWindow(done, at(-60_000))).toBe(false);
  });

  it("lo deshecho tiene su propio texto en Auditoría", () => {
    for (const action of Object.values(UNDONE_ACTIONS)) expect(describeAuditAction(action, "Case").label).toMatch(/deshizo/);
  });
});
