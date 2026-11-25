import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsForms from "@/components/admin/SettingsForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website Settings" };

export default async function SettingsPage() {
  await requirePage("settings.manage");
  const s = await getSettings();
  return (
    <>
      <div className="head"><div><h1>Website Settings</h1><p>Site details, social links and the homepage widgets. Widgets switched off are hidden from the website.</p></div></div>
      <SettingsForms s={s} />
    </>
  );
}
