import type { MetadataRoute } from "next";

// Permite "Agregar a la pantalla de inicio" en el celular (útil para el
// relevamiento de emergencia, que se puede usar sin conexión).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MuniGestión 3F",
    short_name: "MuniGestión 3F",
    description: "Desarrollo Humano y Hábitat · Municipalidad de Tres de Febrero",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#163C68",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
