import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFichaSocialByDniFromDb } from "@/services/ficha-social";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawDni = searchParams.get("dni") || "";

    const result = await getFichaSocialByDniFromDb(rawDni);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ encontrado: false, error: error.message }, { status: 500 });
  }
}
