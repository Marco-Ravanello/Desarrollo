import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveStormVictimRecord } from "@/services/emergency-save";
import { StormVictimItem } from "@/types/emergency";

/**
 * Recibe las fichas de emergencia, incluidas las que se cargaron sin conexión
 * y quedaron guardadas en el dispositivo. Cada ficha trae un `clientId`, así
 * que reenviarla no la duplica.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Tu sesión venció. Volvé a iniciar sesión para enviar las fichas." }, { status: 401 });
  }

  let body: Partial<StormVictimItem>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "La ficha llegó incompleta." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !body.nombreApellido?.trim() || !body.domicilio?.trim()) {
    return NextResponse.json({ success: false, error: "Faltan el nombre o el domicilio." }, { status: 400 });
  }

  const result = await saveStormVictimRecord(session.user, body);
  return NextResponse.json(result, { status: result.success ? 200 : 422 });
}
