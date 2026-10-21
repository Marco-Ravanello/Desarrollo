import type { ReactNode } from "react";

// Con "absolute" esta pantalla lleva el nombre completo; "template" lo mantiene para Cruces de programas.
export const metadata = { title: { absolute: "Ficha Social 360° · MuniGestión 3F", template: "%s · MuniGestión 3F" } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
