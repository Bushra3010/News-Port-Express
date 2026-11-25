import xss from "xss";

/* ───────── Slugs ───────── */

/** URL slug that keeps Devanagari and Latin letters/digits. Example: "Lucknow मेट्रो 2" → "lucknow-मेट्रो-2". */
export function slugify(input: string, max = 90): string {
  const s = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’'"`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : max).replace(/-+$/g, "");
}

export const isValidSlug = (s: string) => /^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u.test(s) && s.length <= 120;

/** Top-level paths that a category slug may not take. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "media", "news", "state", "search", "latest", "trending", "videos", "photos", "tag", "author", "page",
  "sitemap.xml", "news-sitemap.xml", "sitemaps", "robots.txt", "my-city", "breaking", "feed", "rss", "favicon.ico",
  "special-reports-list", "_next",
]);

/* ───────── HTML sanitizing (article bodies, pages) ───────── */

const allowAttrs = ["class", "title"];
const whiteList: Record<string, string[]> = {
  p: allowAttrs, br: [], strong: [], b: [], em: [], i: [], u: [], s: [], mark: [], sub: [], sup: [], small: [],
  h2: ["id"], h3: ["id"], h4: ["id"], blockquote: allowAttrs, ul: [], ol: ["start"], li: [], hr: [],
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  figure: allowAttrs, figcaption: [], table: [], thead: [], tbody: [], tr: [], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"],
  code: [], pre: [], span: allowAttrs, div: allowAttrs,
  iframe: ["src", "width", "height", "allowfullscreen", "title", "loading"],
};

const SAFE_IFRAME = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.facebook\.com)\//i;

export function sanitizeHtml(html: string): string {
  return xss(html, {
    whiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "noscript"],
    onTagAttr(tag, name, value) {
      if ((name === "href" || name === "src") && /^\s*(javascript|vbscript|data):/i.test(value)) return "";
      if (tag === "iframe" && name === "src" && !SAFE_IFRAME.test(value)) return "";
      if (tag === "a" && name === "target") return 'target="_blank"';
      return undefined;
    },
    onIgnoreTagAttr() {
      return "";
    },
  })
    .replace(/<a ([^>]*target="_blank"[^>]*)>/g, (m, attrs: string) => (/rel=/.test(attrs) ? m : `<a ${attrs} rel="noopener noreferrer">`))
    .replace(/<iframe(?![^>]*src=")[^>]*><\/iframe>/g, "");
}

/** Plain text, single-line, length-limited (titles, descriptions, names). */
export function cleanText(v: unknown, max = 500): string {
  return String(v ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/* ───────── Video embeds ───────── */

export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function youtubeThumb(url: string | null | undefined): string | null {
  const yt = url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

/* ───────── Dates (always shown in IST) ───────── */

const TZ = "Asia/Kolkata";

export function istDay(ms = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function hiDate(ms: number): string {
  return new Intl.DateTimeFormat("hi-IN", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(ms);
}

export function hiDateTime(ms: number): string {
  return new Intl.DateTimeFormat("hi-IN", { timeZone: TZ, day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);
}

export function hiLongToday(): string {
  return new Intl.DateTimeFormat("hi-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(Date.now());
}

export function timeAgo(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 1) return "अभी";
  if (m < 60) return `${m} मिनट पहले`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} घंटे पहले`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} दिन पहले`;
  return hiDate(ms);
}

export function hhmm(ms: number): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);
}

/** "2026-11-26T14:30" in IST ↔ epoch ms, for <input type="datetime-local">. */
export function toIstInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function fromIstInput(v: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const ms = Date.parse(v + ":00Z") - 5.5 * 3600_000;
  return Number.isFinite(ms) ? ms : null;
}

export function readingMinutes(html: string) {
  return Math.max(1, Math.round(stripHtml(html).split(" ").length / 200));
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
