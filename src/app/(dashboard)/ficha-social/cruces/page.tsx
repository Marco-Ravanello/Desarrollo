import { redirect } from "next/navigation";

// Cruces de programas ahora vive en Registro Único › Programas. Se conservan los filtros de la dirección.
export default async function CrucesViejoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v);
  }
  const qs = params.toString();
  redirect(`/people/programas/cruces${qs ? `?${qs}` : ""}`);
}
