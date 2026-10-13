// Usa la configuración completa (con acceso a la base) para cortar las sesiones de cuentas suspendidas.
export { auth as default } from "@/auth";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
