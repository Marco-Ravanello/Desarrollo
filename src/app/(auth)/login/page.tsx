import { getMunicipalSettings } from "@/services/municipal-settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ingresar" };

/** Ingreso: el teléfono de ayuda sale de Configuración, para quien se olvidó la contraseña. */
export default async function LoginPage() {
  const { helpdeskPhone } = await getMunicipalSettings();
  return <LoginForm helpdeskPhone={helpdeskPhone} />;
}
