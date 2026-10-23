import { NextResponse } from "next/server";
import { getMunicipalSettings } from "@/services/municipal-settings";

// El logo propio que se carga en Configuración. Si no hay, el de fábrica.
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function GET(request: Request) {
  const { customLogoUrl } = await getMunicipalSettings();
  const logo = customLogoUrl.trim();
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(logo);
  if (match && TYPES.has(match[1])) {
    return new NextResponse(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": match[1],
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // Un SVG abierto solo no puede correr nada.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  }
  if (/^https:\/\//i.test(logo)) return NextResponse.redirect(logo);
  return NextResponse.redirect(new URL("/logo-3f.png", request.url));
}
