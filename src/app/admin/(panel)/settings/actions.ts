"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSettings, saveSetting, type Settings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fstr, ValidationError, type FormState } from "@/lib/forms";
import { cleanText, isHttpUrl } from "@/lib/util";

const url = (fd: FormData, k: string) => {
  const v = fstr(fd, k);
  if (v && !isHttpUrl(v)) throw new ValidationError(`“${k}” must be a full https:// link.`);
  return v;
};

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requireUser("settings.manage");
    const cur = await getSettings();
    const section = fstr(fd, "section");
    let value: Settings[keyof Settings];
    switch (section) {
      case "site": {
        const v: Settings["site"] = {
          ...cur.site,
          name: cleanText(fd.get("name"), 80) || cur.site.name,
          tagline: cleanText(fd.get("tagline"), 120),
          description: cleanText(fd.get("description"), 300),
          contactEmail: cleanText(fd.get("contactEmail"), 120),
          phone: cleanText(fd.get("phone"), 40),
          address: cleanText(fd.get("address"), 300),
          social: { facebook: url(fd, "facebook"), x: url(fd, "x"), youtube: url(fd, "youtube"), instagram: url(fd, "instagram") },
          epaperUrl: url(fd, "epaperUrl"), appUrl: url(fd, "appUrl"), liveTvUrl: url(fd, "liveTvUrl"),
          googleSiteVerification: cleanText(fd.get("googleSiteVerification"), 120).replace(/[^\w-]/g, ""),
          footerNote: cleanText(fd.get("footerNote"), 200),
        };
        value = v;
        break;
      }
      case "markets": {
        const items = fd.getAll("m_label").map((l, i) => ({
          label: cleanText(l, 40), value: cleanText(fd.getAll("m_value")[i], 30), change: cleanText(fd.getAll("m_change")[i], 20),
          pct: cleanText(fd.getAll("m_pct")[i], 12), up: fd.getAll("m_up")[i] === "1",
        })).filter((m) => m.label && m.value);
        value = { enabled: fbool(fd, "enabled"), items };
        break;
      }
      case "weather":
        value = { enabled: fbool(fd, "enabled"), city: cleanText(fd.get("city"), 40), temp: cleanText(fd.get("temp"), 10), desc: cleanText(fd.get("desc"), 80), minMax: cleanText(fd.get("minMax"), 80) };
        break;
      case "liveScore":
        value = {
          enabled: fbool(fd, "enabled"), match: cleanText(fd.get("match"), 80), team1: cleanText(fd.get("team1"), 40), score1: cleanText(fd.get("score1"), 20),
          overs1: cleanText(fd.get("overs1"), 60), team2: cleanText(fd.get("team2"), 40), score2: cleanText(fd.get("score2"), 20), overs2: cleanText(fd.get("overs2"), 60), status: cleanText(fd.get("status"), 120),
        };
        break;
      case "rashifal":
        value = { enabled: fbool(fd, "enabled"), items: cur.rashifal.items.map((r, i) => ({ sign: r.sign, text: cleanText(fd.get(`r${i}`), 400) })) };
        break;
      case "poll": {
        const options = fstr(fd, "options").split("\n").map((o) => cleanText(o, 80)).filter(Boolean).slice(0, 6);
        const question = cleanText(fd.get("question"), 200);
        if (fbool(fd, "enabled") && (!question || options.length < 2)) throw new ValidationError("A poll needs a question and at least 2 options.");
        const changed = question !== cur.poll.question || options.join("|") !== cur.poll.options.join("|");
        value = { enabled: fbool(fd, "enabled"), question, options, id: changed ? `poll-${Date.now().toString(36)}` : cur.poll.id };
        break;
      }
      default:
        return { error: "Unknown settings section." };
    }
    await saveSetting(section as keyof Settings, value as never, me.id);
    await audit(me, "settings.update", "settings", section);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved. Changes are live on the website." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}
