export const dynamic = "force-dynamic";

import { getSystemSettingsAction } from "@/app/(dashboard)/admin/actions/settings-actions";
import { DEFAULT_MUNICIPAL_SETTINGS } from "@/types/settings";
import { MunicipalSettingsClient } from "./settings-client-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MunicipalSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN_GENERAL" && role !== "DIRECCION_GENERAL") {
    redirect("/dashboard");
  }

  const res = await getSystemSettingsAction();
  const settings = res.success && res.settings ? res.settings : DEFAULT_MUNICIPAL_SETTINGS;

  return <MunicipalSettingsClient initialSettings={settings} />;
}
