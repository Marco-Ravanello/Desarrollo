import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFichaSocialByDniFromDb } from "@/services/ficha-social-db";
import { getFichaHistorial } from "@/services/ficha-historial";
import { getGrupoFamiliar } from "@/services/grupo-familiar";
import { cleanDni } from "@/services/ficha-social";
import { hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // El relevador de emergencia no usa la Ficha Social.
  if (isEmergencySurveyor(session.user.role)) {
    return NextResponse.json({ error: "Tu usuario no puede consultar la Ficha Social." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawDni = searchParams.get("dni") || "";

    const result = await getFichaSocialByDniFromDb(rawDni);
    const dni = cleanDni(rawDni);
    if (!dni) return NextResponse.json(result);

    const canViewSensitive = hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES);
    const [historial, grupo_familiar] = await Promise.all([
      getFichaHistorial(dni, { canViewSensitive }),
      getGrupoFamiliar(dni, { canViewSensitive }),
    ]);
    if (result.encontrado) {
      return NextResponse.json({ ...result, en_padron: true, historial, grupo_familiar });
    }

    // No está en el padrón de programas, pero la municipalidad lo atendió.
    if (historial.personaId || historial.fichasTormenta.length > 0) {
      return NextResponse.json({
        encontrado: true,
        en_padron: false,
        dni,
        nombre_detectado: historial.nombre || `DNI ${dni}`,
        total_programas: 0,
        programas_activos: [],
        detalle_programas: {},
        relaciones_familiares: [],
        historial,
        grupo_familiar,
      });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ encontrado: false, error: error.message }, { status: 500 });
  }
}
