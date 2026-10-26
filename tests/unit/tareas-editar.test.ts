import { describe, expect, it } from "vitest";
import { isTaskPriority, parseViewerIds, serializeViewerIds, taskDueAt, taskDueParts } from "@/lib/tasks";

describe("editar una tarea", () => {
  it("guarda el día y la hora de Argentina y los vuelve a mostrar igual", () => {
    expect(taskDueAt("2026-10-27", "14:30")?.toISOString()).toBe("2026-10-27T17:30:00.000Z");
    expect(taskDueAt("2026-10-27", "")?.toISOString()).toBe("2026-10-27T12:00:00.000Z");
    expect(taskDueAt("2026-10-27", "22:15")?.toISOString()).toBe("2026-10-28T01:15:00.000Z");
    expect(taskDueAt("2026-02-30", "10:00")).toBeNull();
    expect(taskDueAt("27/10/2026")).toBeNull();
    expect(taskDueParts("2026-10-28T01:15:00.000Z")).toEqual({ day: "2026-10-27", time: "22:15" });
    expect(taskDueParts(new Date("2026-10-27T12:00:00.000Z"))).toEqual({ day: "2026-10-27", time: "09:00" });
    expect(taskDueParts(null)).toEqual({ day: "", time: "09:00" });
  });

  it("comparte sin repetir y sin la persona dueña de la tarea", () => {
    expect(parseViewerIds(" a, b,,a ")).toEqual(["a", "b"]);
    expect(parseViewerIds(null)).toEqual([]);
    expect(serializeViewerIds(["a", "dueña", "b", "a", " "], "dueña")).toBe("a,b");
    expect(serializeViewerIds(["dueña"], "dueña")).toBeNull();
  });

  it("solo acepta las prioridades de la lista", () => {
    expect(isTaskPriority("URGENTE")).toBe(true);
    expect(isTaskPriority("MEDIA")).toBe(true);
    expect(isTaskPriority("CRITICA")).toBe(false);
  });
});
