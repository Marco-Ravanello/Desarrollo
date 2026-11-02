import { redirect } from "next/navigation";
import { cleanDni } from "@/services/ficha-social";

// La Ficha Social 360° se sacó del menú: cada persona tiene su ficha en el Registro Único
// (/people/[dni]). Los enlaces viejos siguen andando: con DNI van a esa ficha, sin DNI al Registro Único.
export default async function FichaSocialPage({ searchParams }: { searchParams: Promise<{ dni?: string }> }) {
  const { dni } = await searchParams;
  const clean = cleanDni(dni || "");
  redirect(clean.length >= 4 ? `/people/${clean}` : "/people");
}
