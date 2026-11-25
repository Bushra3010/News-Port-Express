"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { useState } from "react";
import { saveSettings } from "@/app/admin/(panel)/settings/actions";
import type { Settings } from "@/lib/settings";
import type { FormState } from "@/lib/forms";

function Section({ section, title, children, hint }: { section: string; title: string; children: React.ReactNode; hint?: string }) {
  const [state, action, pending] = useFormAction(saveSettings);
  return (
    <form onSubmit={action} className="card form">
      <h2>{title}</h2>
      {hint ? <p className="hint" style={{ margin: 0 }}>{hint}</p> : null}
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.message}</div> : null}
      <input type="hidden" name="section" value={section} />
      {children}
      <div><button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

const On = ({ v }: { v: boolean }) => <label className="check"><input type="checkbox" name="enabled" defaultChecked={v} />Show on website</label>;

export default function SettingsForms({ s }: { s: Settings }) {
  const [markets, setMarkets] = useState(s.markets.items);
  return (
    <div className="grid">
      <Section section="site" title="Site details">
        <div className="grid g2">
          <label>Site name<input type="text" name="name" defaultValue={s.site.name} required /></label>
          <label>Tagline<input type="text" name="tagline" defaultValue={s.site.tagline} /></label>
        </div>
        <label>Description <small>Used for the homepage meta description and footer</small><textarea name="description" defaultValue={s.site.description} rows={2} /></label>
        <div className="grid g3">
          <label>Contact email<input type="text" name="contactEmail" defaultValue={s.site.contactEmail} /></label>
          <label>Phone<input type="text" name="phone" defaultValue={s.site.phone} /></label>
          <label>Address<input type="text" name="address" defaultValue={s.site.address} /></label>
        </div>
        <div className="grid g2">
          <label>Facebook URL<input type="url" name="facebook" defaultValue={s.site.social.facebook} /></label>
          <label>X (Twitter) URL<input type="url" name="x" defaultValue={s.site.social.x} /></label>
          <label>YouTube URL<input type="url" name="youtube" defaultValue={s.site.social.youtube} /></label>
          <label>Instagram URL<input type="url" name="instagram" defaultValue={s.site.social.instagram} /></label>
        </div>
        <div className="grid g3">
          <label>Live TV link <small>LIVE TV button target (otherwise /videos)</small><input type="url" name="liveTvUrl" defaultValue={s.site.liveTvUrl} /></label>
          <label>E-paper link<input type="url" name="epaperUrl" defaultValue={s.site.epaperUrl} /></label>
          <label>App download link<input type="url" name="appUrl" defaultValue={s.site.appUrl} /></label>
        </div>
        <div className="grid g2">
          <label>Google Search Console verification code <small>Only the content value of the meta tag</small><input type="text" name="googleSiteVerification" defaultValue={s.site.googleSiteVerification} /></label>
          <label>Footer note<input type="text" name="footerNote" defaultValue={s.site.footerNote} /></label>
        </div>
      </Section>

      <div className="grid g2" style={{ alignItems: "start" }}>
        <Section section="markets" title="Market ticker" hint="Shown under the breaking-news bar. Update the figures yourself or leave it off.">
          <On v={s.markets.enabled} />
          {markets.map((m, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr .8fr .7fr auto", gap: 6, alignItems: "end" }}>
              <label>Name<input type="text" name="m_label" defaultValue={m.label} /></label>
              <label>Value<input type="text" name="m_value" defaultValue={m.value} /></label>
              <label>Change<input type="text" name="m_change" defaultValue={m.change} /></label>
              <label>%<input type="text" name="m_pct" defaultValue={m.pct} /></label>
              <label>Dir<select name="m_up" defaultValue={m.up ? "1" : "0"}><option value="1">▲</option><option value="0">▼</option></select></label>
              <button type="button" className="link-btn danger" onClick={() => setMarkets((x) => x.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setMarkets((x) => [...x, { label: "", value: "", change: "", pct: "", up: true }])}>＋ Add row</button>
        </Section>

        <Section section="weather" title="Weather box">
          <On v={s.weather.enabled} />
          <div className="grid g2">
            <label>City<input type="text" name="city" defaultValue={s.weather.city} /></label>
            <label>Temperature<input type="text" name="temp" defaultValue={s.weather.temp} placeholder="18°" /></label>
          </div>
          <label>Conditions<input type="text" name="desc" defaultValue={s.weather.desc} /></label>
          <label>Min / Max<input type="text" name="minMax" defaultValue={s.weather.minMax} /></label>
        </Section>

        <Section section="liveScore" title="Live cricket score" hint="Shown beside the sports section while switched on.">
          <On v={s.liveScore.enabled} />
          <label>Match<input type="text" name="match" defaultValue={s.liveScore.match} placeholder="तीसरा वनडे · राजकोट" /></label>
          <div className="grid g3">
            <label>Team 1<input type="text" name="team1" defaultValue={s.liveScore.team1} /></label>
            <label>Score<input type="text" name="score1" defaultValue={s.liveScore.score1} /></label>
            <label>Overs / note<input type="text" name="overs1" defaultValue={s.liveScore.overs1} /></label>
            <label>Team 2<input type="text" name="team2" defaultValue={s.liveScore.team2} /></label>
            <label>Score<input type="text" name="score2" defaultValue={s.liveScore.score2} /></label>
            <label>Overs / note<input type="text" name="overs2" defaultValue={s.liveScore.overs2} /></label>
          </div>
          <label>Status line<input type="text" name="status" defaultValue={s.liveScore.status} /></label>
        </Section>

        <Section section="poll" title="Reader poll" hint="Changing the question or options starts a new poll with fresh votes.">
          <On v={s.poll.enabled} />
          <label>Question<input type="text" name="question" defaultValue={s.poll.question} /></label>
          <label>Options <small>One per line, 2–6</small><textarea name="options" defaultValue={s.poll.options.join("\n")} rows={4} /></label>
        </Section>
      </div>

      <Section section="rashifal" title="Today’s Rashifal (राशिफल)" hint="Update daily. Shown on the homepage when switched on and at least one sign has text.">
        <On v={s.rashifal.enabled} />
        <div className="grid g3">
          {s.rashifal.items.map((r, i) => <label key={r.sign}>{r.sign}<textarea name={`r${i}`} defaultValue={r.text} rows={2} maxLength={400} /></label>)}
        </div>
      </Section>
    </div>
  );
}
