"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** "मेरा शहर" band: tabs switch between cities whose stories are already rendered on the server. */
export function CityTabs({ cities, panels, allHref }: { cities: { id: number; name: string; href: string }[]; panels: Record<number, ReactNode>; allHref?: string }) {
  const [active, setActive] = useState(cities[0]?.id);
  if (!cities.length) return null;
  const cur = cities.find((c) => c.id === active) ?? cities[0];
  return (
    <section className="card band">
      <div className="sec-h">
        <h2>मेरा शहर</h2>
        <div className="tabs" role="tablist">
          {cities.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === cur.id} className={c.id === cur.id ? "on" : ""} onClick={() => setActive(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>
      <div role="tabpanel">{panels[cur.id]}</div>
      <p style={{ margin: "12px 0 0", textAlign: "right" }}>
        <Link href={cur.href} style={{ color: "var(--orange)", fontWeight: 700 }}>{cur.name} की सभी खबरें ›</Link>
        {allHref ? <> · <Link href={allHref} style={{ color: "var(--orange)", fontWeight: 700 }}>सभी शहर ›</Link></> : null}
      </p>
    </section>
  );
}

const SYM = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

export function Rashifal({ items }: { items: { sign: string; text: string }[] }) {
  const [i, setI] = useState(0);
  const list = items.filter((x) => x.sign);
  if (!list.length) return null;
  return (
    <div className="card side">
      <div className="sec-h"><h2>आज का राशिफल</h2></div>
      <div className="rashi" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {list.map((r, k) => (
          <button key={r.sign} onClick={() => setI(k)} aria-pressed={k === i}><span className="sym">{SYM[k] ?? "✦"}</span><span className="n">{r.sign}</span></button>
        ))}
      </div>
      <div className="rbox" aria-live="polite"><b>{list[i].sign}:</b> {list[i].text || "आज का फल जल्द अपडेट होगा।"}</div>
    </div>
  );
}

export function Poll({ id, question, options }: { id: string; question: string; options: string[] }) {
  const [result, setResult] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(`np-poll-${id}`)) fetch(`/api/poll?id=${encodeURIComponent(id)}`).then((r) => r.json() as Promise<{ votes: number[] }>).then((d) => setResult(d.votes)).catch(() => {});
    } catch { /* storage unavailable */ }
  }, [id]);
  const vote = async (k: number) => {
    if (busy || result) return;
    setBusy(true);
    try {
      const r = await fetch("/api/poll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, option: k }) });
      const d = (await r.json()) as { votes?: number[] };
      if (d.votes) setResult(d.votes);
      try { localStorage.setItem(`np-poll-${id}`, "1"); } catch { /* ignore */ }
    } finally {
      setBusy(false);
    }
  };
  const total = result ? result.reduce((a, b) => a + b, 0) || 1 : 1;
  return (
    <div className="card side poll">
      <div className="sec-h"><h2>आपकी राय</h2></div>
      <b>{question}</b>
      {options.map((o, k) => {
        const pct = result ? Math.round(((result[k] ?? 0) / total) * 100) : 0;
        return (
          <button key={k} onClick={() => vote(k)} disabled={!!result || busy}>
            <i style={{ width: result ? `${pct}%` : 0 }} />
            <span>{o} <em>{result ? `${pct}%` : ""}</em></span>
          </button>
        );
      })}
    </div>
  );
}

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const native = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="share">
      <span style={{ background: "none", padding: 0, fontWeight: 700 }}>शेयर करें:</span>
      <a href={`https://wa.me/?text=${t}%20${u}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">X</a>
      <a href={`https://t.me/share/url?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">Telegram</a>
      <button type="button" onClick={native}>{copied ? "लिंक कॉपी हुआ ✓" : "लिंक कॉपी करें"}</button>
    </div>
  );
}

/** Counts one view per article per browser session. */
export function ViewBeacon({ id }: { id: number }) {
  useEffect(() => {
    const key = `np-v-${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* still count */ }
    const body = JSON.stringify({ id });
    if (!navigator.sendBeacon?.("/api/view", new Blob([body], { type: "application/json" }))) {
      fetch("/api/view", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [id]);
  return null;
}
