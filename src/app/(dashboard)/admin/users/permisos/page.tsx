export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { ArrowLeft, Check, Minus, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { cn } from "@/lib/utils";
import { ROLE_INFO } from "@/lib/roles";
import { MATRIX_ROLES, ROLE_MATRIX, roleTotals, type Access } from "@/lib/role-matrix";

export const metadata = { title: "Permisos por rol" };

const chipClass = (active: boolean) =>
  cn(
    "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
    active ? "border border-border/40 bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
  );

function Cell({ access }: { access: Access }) {
  if (access.level === "si") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 p-1 text-primary" title="Sí">
        <Check className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Sí</span>
      </span>
    );
  }
  if (access.level === "parcial") {
    return (
      <span className="inline-block rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-amber-900 dark:text-amber-200">
        {access.note ?? "Con límite"}
      </span>
    );
  }
  return (
    <span className="inline-flex text-muted-foreground/60" title="No">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

/** Qué puede ver y hacer cada rol, en una tabla. Solo el Superadmin. Sale de las mismas reglas que usa la app. */
export default async function RolePermissionsPage({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    return <EmptyMessage kind="empty" title="Esta pantalla es solo para el Superadmin" description="Volvé a Usuarios para ver el resto." />;
  }

  const { rol } = await searchParams;
  const picked = MATRIX_ROLES.find((r) => r === rol) ?? null;
  const roles: Role[] = picked ? [picked] : MATRIX_ROLES;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Permisos por rol"
        description="Qué puede ver y hacer cada rol. La tabla sale de las mismas reglas que usa la app, así que siempre está al día."
        icon={ShieldCheck}
        actions={
          <Button asChild variant="outline" className="hidden gap-2 sm:inline-flex">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a Usuarios
            </Link>
          </Button>
        }
      />

      <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/40 bg-muted/30 p-1" aria-label="Qué rol ver">
        <Link href="/admin/users/permisos" className={chipClass(!picked)} aria-current={!picked ? "page" : undefined}>
          Todos
        </Link>
        {MATRIX_ROLES.map((r) => (
          <Link key={r} href={`/admin/users/permisos?rol=${r}`} className={chipClass(picked === r)} aria-current={picked === r ? "page" : undefined}>
            {ROLE_INFO[r].label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Cell access={{ level: "si" }} /> Puede
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cell access={{ level: "parcial", note: "Su área" }} /> Puede, con ese límite
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cell access={{ level: "no" }} /> No puede
        </span>
        {!picked && <span className="md:hidden">Deslizá la tabla para ver todos los roles, o elegí uno arriba.</span>}
      </div>

      {picked && (
        <Card className="p-4 text-sm">
          <p className="font-semibold text-foreground">{ROLE_INFO[picked].label}</p>
          <p className="mt-0.5 text-muted-foreground">{ROLE_INFO[picked].description}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-14rem)] overflow-auto">
          <table className={cn("w-full border-separate border-spacing-0 text-sm", !picked && "min-w-[980px]")}>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-30 border-b border-border/60 bg-card px-3 py-2.5 text-left text-xs font-bold text-muted-foreground">
                  Qué
                </th>
                {roles.map((r) => {
                  const t = roleTotals(r);
                  return (
                    <th
                      key={r}
                      scope="col"
                      title={ROLE_INFO[r].description}
                      className="sticky top-0 z-20 w-[104px] border-b border-border/60 bg-card px-2 py-2.5 text-center align-bottom text-xs font-bold text-foreground"
                    >
                      <span className="block leading-tight">{ROLE_INFO[r].label}</span>
                      <span className="mt-0.5 block font-medium tabular-nums text-muted-foreground">
                        {t.si + t.parcial} de {t.total}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {ROLE_MATRIX.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={roles.length + 1}
                    className="sticky left-0 border-b border-border/60 bg-muted/60 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.label} className="hover:bg-muted/30">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 w-[260px] max-w-[260px] border-b border-border/40 bg-card px-3 py-2 text-left align-middle font-medium text-foreground"
                    >
                      <span className="block [overflow-wrap:anywhere]">{row.label}</span>
                      {row.hint && <span className="block text-xs font-normal text-muted-foreground">{row.hint}</span>}
                    </th>
                    {roles.map((r) => (
                      <td key={r} className="border-b border-border/40 px-2 py-2 text-center align-middle">
                        <Cell access={row.access(r)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>

      {!picked && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">Qué hace cada rol</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {MATRIX_ROLES.map((r) => (
              <div key={r}>
                <dt className="font-semibold text-foreground">{ROLE_INFO[r].label}</dt>
                <dd className="text-muted-foreground">{ROLE_INFO[r].description}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Además de esto, cada persona ve solo lo que le corresponde por su área donde la regla lo dice. Para probar cómo ve la app un rol, usá «Ver como» en
        el Inicio.
      </p>
    </div>
  );
}
