// Usa la configuración completa (con acceso a la base) para cortar las sesiones de cuentas suspendidas.
export { auth as default } from "@/auth";

export const config = {
  runtime: "nodejs",
  // El logo y los íconos se ven también en la pantalla de ingreso, sin sesión.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo-3f).*)"],
};
