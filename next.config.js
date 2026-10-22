/** @type {import('next').NextConfig} */

// Protecciones estándar del navegador para todas las páginas: no dejar que la app
// se muestre dentro de otra página, no adivinar tipos de archivo, no mandar la
// dirección completa a otros sitios y pedir a los buscadores que no la indexen
// (es una herramienta interna con datos personales).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig = {
  // Los errores de tipos y de ESLint frenan el build: así no llega a
  // producción código roto sin que nadie se entere.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
