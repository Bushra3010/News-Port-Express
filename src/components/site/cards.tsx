import Link from "next/link";
import type { ReactNode } from "react";
import { articleHref, mediaUrl, type Card } from "@/lib/news";
import { timeAgo, youtubeThumb } from "@/lib/util";

// Gradient placeholder colours per category (from the original design), used when a story has no image.
const HUES: Record<string, [number, number]> = {
  desh: [222, 18], videsh: [200, 170], rajniti: [8, 225], karobar: [160, 210], tech: [250, 190], shiksha: [35, 10],
  khel: [140, 95], cricket: [140, 95], manoranjan: [320, 280], crime: [355, 230], health: [170, 130], lifestyle: [340, 20],
  dharm: [28, 48], "special-reports": [225, 0], video: [0, 330],
};

function hues(slug: string | null): [number, number] {
  if (slug && HUES[slug]) return HUES[slug];
  let h = 0;
  for (const ch of slug || "x") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [h, (h + 160) % 360];
}

export function Thumb({
  card, seed = 0, children, priority = false, label,
}: { card: Pick<Card, "imageKey" | "imageAlt" | "imageW" | "imageH" | "categorySlug" | "categoryName" | "title" | "videoUrl">; seed?: number; children?: ReactNode; priority?: boolean; label?: string }) {
  const src = mediaUrl(card.imageKey) || youtubeThumb(card.videoUrl);
  if (src) {
    return (
      <span className="th">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={card.imageAlt || card.title} width={card.imageW || 640} height={card.imageH || 360}
          loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
        {children}
      </span>
    );
  }
  const [h1, h2] = hues(card.categorySlug);
  const k = (seed * 37) % 100;
  const g = `linear-gradient(${120 + k}deg,hsl(${h1} 55% 32%),hsl(${h2} 70% 52%))`;
  return (
    <span className="th" style={{ ["--g" as string]: g }}>
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx={30 + k} cy={20 + (k % 40)} r={24 + (k % 18)} fill="#ffffff" fillOpacity=".10" />
        <circle cx={130 - k / 2} cy={70 - (k % 30)} r={34 + (k % 12)} fill="#ffffff" fillOpacity=".08" />
        <path d={`M0 ${70 + (k % 10)} Q40 ${50 + (k % 20)} 80 68 T160 ${60 + (k % 15)} V90 H0Z`} fill="#000000" fillOpacity=".18" />
        <text x="150" y="28" textAnchor="end" fontFamily="Mukta,sans-serif" fontSize="22" fontWeight="800" fill="#ffffff" fillOpacity=".9">{label ?? card.categoryName ?? ""}</text>
      </svg>
      {children}
    </span>
  );
}

export function Meta({ card, showCity = false }: { card: Card; showCity?: boolean }) {
  return (
    <div className="meta">
      <span>{showCity && card.cityName ? card.cityName : card.categoryName}</span>
      {card.publishedAt ? (<><span>•</span><time dateTime={new Date(card.publishedAt).toISOString()}>{timeAgo(card.publishedAt)}</time></>) : null}
    </div>
  );
}

const Badge = ({ card }: { card: Card }) => (card.categoryName ? <span className="ct">{card.categoryName}</span> : null);
const PlayBadge = ({ card }: { card: Card }) => (card.type === "video" ? <span className="play" aria-hidden="true">▶</span> : null);

export function StoryCard({ card, i = 0, badge = true, showCity = false }: { card: Card; i?: number; badge?: boolean; showCity?: boolean }) {
  return (
    <Link href={articleHref(card)} className="story">
      <Thumb card={card} seed={i}>{badge ? <Badge card={card} /> : null}<PlayBadge card={card} /></Thumb>
      <h3>{card.title}</h3>
      <Meta card={card} showCity={showCity} />
    </Link>
  );
}

export function MiniCard({ card, i = 0 }: { card: Card; i?: number }) {
  return (
    <Link href={articleHref(card)} className="mini">
      <Thumb card={card} seed={i}><PlayBadge card={card} /></Thumb>
      <div><h3>{card.title}</h3><Meta card={card} /></div>
    </Link>
  );
}

export function LeadCard({ card, heading: H = "h2" }: { card: Card; heading?: "h1" | "h2" }) {
  return (
    <Link href={articleHref(card)} className="lead">
      <Thumb card={card} seed={3} priority><Badge card={card} /><PlayBadge card={card} /></Thumb>
      <H className="lead-h">{card.title}</H>
      {card.summary ? <p>{card.summary}</p> : null}
      <Meta card={card} />
    </Link>
  );
}

export function SectionHead({ title, href, as: H = "h2" }: { title: string; href?: string; as?: "h1" | "h2" }) {
  return (
    <div className="sec-h">
      <H>{title}</H>
      {href ? <Link href={href}>और देखें ›</Link> : null}
    </div>
  );
}

export function Grid({ cards, cols = 4, className = "", showCity = false }: { cards: Card[]; cols?: 3 | 4; className?: string; showCity?: boolean }) {
  return (
    <div className={`${cols === 4 ? "grid4" : "grid3"} ${className}`}>
      {cards.map((c, i) => <StoryCard key={c.id} card={c} i={i} showCity={showCity} />)}
    </div>
  );
}

export function Pager({ page, total, perPage, base }: { page: number; total: number; perPage: number; base: string }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`);
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label="पेज">
      {page > 1 ? <Link href={href(page - 1)} rel="prev">‹ पिछला</Link> : null}
      {nums.map((p, i) => (
        <span key={p} style={{ display: "contents" }}>
          {i > 0 && p - nums[i - 1] > 1 ? <span aria-hidden="true">…</span> : null}
          {p === page ? <span className="cur" aria-current="page">{p}</span> : <Link href={href(p)}>{p}</Link>}
        </span>
      ))}
      {page < pages ? <Link href={href(page + 1)} rel="next">अगला ›</Link> : null}
    </nav>
  );
}

/** The standard category/listing layout: lead + side stack, then a grid, then pagination. */
export function ListingBody({ cards, page, total, perPage, base, showCity = false }: { cards: Card[]; page: number; total: number; perPage: number; base: string; showCity?: boolean }) {
  if (!cards.length) return <p className="empty">इस श्रेणी में अभी कोई खबर प्रकाशित नहीं हुई है।</p>;
  const lead = page === 1 ? cards[0] : null;
  const side = page === 1 ? cards.slice(1, 5) : [];
  const rest = page === 1 ? cards.slice(5) : cards;
  return (
    <>
      {lead ? (
        <section className="top" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
          <LeadCard card={lead} />
          <div className="stack">{side.map((c, i) => <MiniCard key={c.id} card={c} i={i + 1} />)}</div>
        </section>
      ) : null}
      {rest.length ? <section><Grid cards={rest} showCity={showCity} /></section> : null}
      <Pager page={page} total={total} perPage={perPage} base={base} />
    </>
  );
}
