// Usa la configuración completa (con acceso a la base) para cortar las sesiones de cuentas suspendidas.
export { auth as default } from "@/auth";

export const config = {
  runtime: "nodejs",
  // El logo, los íconos y el modo sin conexión (sw.js, manifest) se cargan también sin sesión.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-3f|sw.js|manifest.webmanifest|robots.txt).*)"],
};
