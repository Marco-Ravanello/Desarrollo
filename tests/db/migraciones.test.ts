import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Al publicar se aplican las migraciones de prisma/migrations. Si alguien cambia
// prisma/schema.prisma y se olvida de la migración, la base publicada no
// tendría las columnas nuevas y la app fallaría.
describe("migraciones de la base", () => {
  it("dejan la base igual a lo que describe schema.prisma", () => {
    let diff = "";
    try {
      execFileSync(
        "npx",
        ["prisma", "migrate", "diff", "--from-url", process.env.DATABASE_URL!, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code", "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (err: any) {
      if (err.status !== 2) throw err;
      diff = err.stdout;
    }
    expect(diff, "Falta una migración en prisma/migrations para estos cambios del schema").toBe("");
  });
});
