import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createFuelRecordAction } from "@/app/(dashboard)/admin/actions/vehicle-actions";
import { addTaskAction } from "@/app/(dashboard)/tasks/actions";
import { resetSystemSettingsAction, saveSystemSettingsAction } from "@/app/(dashboard)/admin/actions/settings-actions";
import { getMunicipalSettings, SETTINGS_KEY } from "@/services/municipal-settings";
import { getLastLogins } from "@/services/system";
import { GET as getLogo } from "@/app/api/logo/route";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada corrida.

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("fechas que se eligen con un calendario", () => {
  it("la carga de combustible guarda el día elegido (antes fallaba)", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    const vehicle = await prisma.vehicle.create({ data: { plate: "PRU123", brand: "Marca", model: "Prueba" } });
    const res = await createFuelRecordAction(form({ vehicleId: vehicle.id, date: "2026-10-23", amount: "1000", liters: "10", ticketNumber: "T1" }));
    expect(res.error).toBeUndefined();
    const record = await prisma.fuelRecord.findFirstOrThrow({ where: { vehicleId: vehicle.id } });
    expect(record.date.toISOString()).toBe("2026-10-23T15:00:00.000Z");
  });

  it("una tarea con vencimiento queda ese día en Argentina", async () => {
    const user = await createUser("OPERATIVO");
    loginAs(user);
    expect((await addTaskAction("Tarea de prueba", undefined, "2026-10-25")).success).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { userId: user.id } });
    expect(task.dueDate?.toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });
});

describe("Configuración guardada en la base", () => {
  it("la Dirección General la ve pero no la cambia", async () => {
    loginAs(await createUser("DIRECCION_GENERAL"));
    const res = await saveSystemSettingsAction({ municipalityName: "Otro nombre" });
    expect(res.success).toBe(false);
  });

  it("lo que se guarda lo leen todas las pantallas, sin los controles viejos", async () => {
    loginAs(await createUser("SUPERADMIN"));
    const res = await saveSystemSettingsAction({ directionName: "Dirección de Prueba", helpdeskPhone: "Interno 1234", maintenanceMode: true } as any);
    expect(res.success).toBe(true);
    const saved = await getMunicipalSettings();
    expect(saved.directionName).toBe("Dirección de Prueba");
    expect(saved.helpdeskPhone).toBe("Interno 1234");
    const raw = await prisma.systemSetting.findUniqueOrThrow({ where: { key: SETTINGS_KEY } });
    expect(JSON.parse(raw.value)).not.toHaveProperty("maintenanceMode");

    expect((await resetSystemSettingsAction()).success).toBe(true);
    expect(await prisma.systemSetting.count({ where: { key: SETTINGS_KEY } })).toBe(0);
  });

  it("el logo propio se sirve aparte, y si no hay se usa el de fábrica", async () => {
    const req = new Request("http://localhost/api/logo");
    const sinLogo = await getLogo(req);
    expect(sinLogo.status).toBe(307);
    expect(sinLogo.headers.get("location")).toContain("/logo-3f.png");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    await prisma.systemSetting.create({ data: { key: SETTINGS_KEY, value: JSON.stringify({ customLogoUrl: `data:image/png;base64,${png}` }) } });
    const conLogo = await getLogo(req);
    expect(conLogo.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await conLogo.arrayBuffer()).subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(conLogo.headers.get("content-security-policy")).toContain("sandbox");
  });
});

describe("último ingreso de cada usuario", () => {
  it("toma el ingreso más reciente y desde cuándo hay registros", async () => {
    const a = await createUser("OPERATIVO");
    const b = await createUser("OPERATIVO");
    await prisma.auditLog.createMany({
      data: [
        { userId: a.id, action: "LOGIN", entity: "User", entityId: a.id, createdAt: new Date("2026-09-01T12:00:00Z") },
        { userId: a.id, action: "LOGIN", entity: "User", entityId: a.id, createdAt: new Date("2026-10-20T12:00:00Z") },
        { userId: a.id, action: "LOGIN_FAILED", entity: "User", entityId: a.id, createdAt: new Date("2026-10-22T12:00:00Z") },
      ],
    });
    const { byUser, since } = await getLastLogins();
    expect(byUser.get(a.id)?.toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(byUser.has(b.id)).toBe(false);
    expect(since?.toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });
});
