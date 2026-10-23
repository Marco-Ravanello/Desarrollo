import { NotFoundView } from "./not-found-view";
import { getMunicipalSettings } from "@/services/municipal-settings";

export default async function NotFoundPage() {
  const { helpdeskPhone } = await getMunicipalSettings();
  return <NotFoundView helpdeskPhone={helpdeskPhone} />;
}
