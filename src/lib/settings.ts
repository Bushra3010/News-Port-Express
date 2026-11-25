import "server-only";
import { cache } from "react";
import { getDb } from "./db";
import { settings } from "./schema";

export type SiteSettings = {
  name: string; tagline: string; description: string; language: string;
  contactEmail: string; phone: string; address: string;
  social: { facebook: string; x: string; youtube: string; instagram: string };
  epaperUrl: string; appUrl: string; liveTvUrl: string; googleSiteVerification: string; footerNote: string;
};
export type MarketItem = { label: string; value: string; change: string; pct: string; up: boolean };
export type Settings = {
  site: SiteSettings;
  markets: { enabled: boolean; items: MarketItem[] };
  weather: { enabled: boolean; city: string; temp: string; desc: string; minMax: string };
  liveScore: { enabled: boolean; match: string; team1: string; score1: string; overs1: string; team2: string; score2: string; overs2: string; status: string };
  rashifal: { enabled: boolean; items: { sign: string; text: string }[] };
  poll: { enabled: boolean; id: string; question: string; options: string[] };
};

export const DEFAULTS: Settings = {
  site: {
    name: "NewsPort Express", tagline: "सच के साथ, सबसे तेज़",
    description: "NewsPort Express — देश, दुनिया, शहर, खेल, मनोरंजन और कारोबार की हर बड़ी खबर, सबसे पहले।",
    language: "hi", contactEmail: "", phone: "", address: "",
    social: { facebook: "", x: "", youtube: "", instagram: "" },
    epaperUrl: "", appUrl: "", liveTvUrl: "", googleSiteVerification: "", footerNote: "",
  },
  markets: { enabled: false, items: [] },
  weather: { enabled: false, city: "", temp: "", desc: "", minMax: "" },
  liveScore: { enabled: false, match: "", team1: "", score1: "", overs1: "", team2: "", score2: "", overs2: "", status: "" },
  rashifal: { enabled: false, items: [] },
  poll: { enabled: false, id: "poll-1", question: "", options: [] },
};

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await getDb().select().from(settings);
  const out = structuredClone(DEFAULTS) as Record<string, unknown>;
  for (const r of rows) {
    if (!(r.key in out)) continue;
    try {
      const v = JSON.parse(r.value);
      out[r.key] = typeof v === "object" && !Array.isArray(v) ? { ...(out[r.key] as object), ...v } : v;
    } catch {
      /* keep default */
    }
  }
  return out as Settings;
});

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K], userId: number) {
  await getDb()
    .insert(settings)
    .values({ key, value: JSON.stringify(value), updatedBy: userId, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value), updatedBy: userId, updatedAt: Date.now() } });
}
