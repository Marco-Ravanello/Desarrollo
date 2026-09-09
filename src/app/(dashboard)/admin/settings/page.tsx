export const dynamic = "force-dynamic";

import { getSystemSettingsAction } from "@/app/(dashboard)/admin/actions/settings-actions";
import { DEFAULT_MUNICIPAL_SETTINGS } from "@/types/settings";
import { MunicipalSettingsClient } from "./settings-client-form";

export default async function MunicipalSettingsPage() {
  const res = await getSystemSettingsAction();
  const settings = res.success && res.settings ? res.settings : DEFAULT_MUNICIPAL_SETTINGS;

  return <MunicipalSettingsClient initialSettings={settings} />;
}
