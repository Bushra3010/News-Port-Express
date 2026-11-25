import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Mukta, Poppins } from "next/font/google";
import "./site.css";
import Interactions, { CitySelect } from "@/components/site/Interactions";
import { articleHref, cityHref, featuredCities, footerPages, listArticles, navCategories } from "@/lib/news";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/db";
import { hiLongToday } from "@/lib/util";
import JsonLd from "@/components/site/JsonLd";

export const dynamic = "force-dynamic";

const mukta = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-mukta", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-poppins", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSettings();
  const url = siteUrl();
  return {
    metadataBase: new URL(url),
    title: { default: `${site.name} – ${site.tagline}`, template: `%s | ${site.name}` },
    description: site.description,
    applicationName: site.name,
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: site.name, locale: "hi_IN", images: [{ url: "/logo-np.jpg", width: 640, height: 296 }] },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    verification: site.googleSiteVerification ? { google: site.googleSiteVerification } : undefined,
    icons: { icon: "/favicon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0b2e8a" }, { media: "(prefers-color-scheme: dark)", color: "#0b1222" }],
};

// Applies the saved light/dark choice before first paint.
const themeScript = `try{var t=localStorage.getItem("np-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

const Icon = {
  menu: <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>,
  search: <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" fill="none" /><path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
};

function Social({ s }: { s: { facebook: string; x: string; youtube: string; instagram: string } }) {
  const items: [string, string, string][] = [["f", "Facebook", s.facebook], ["X", "X", s.x], ["▶", "YouTube", s.youtube], ["in", "Instagram", s.instagram]];
  const live = items.filter(([, , href]) => href);
  if (!live.length) return null;
  return (
    <div className="soc" aria-label="सोशल मीडिया">
      {live.map(([sym, label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><span>{sym}</span></a>)}
    </div>
  );
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, cats, cityList, pages, breaking] = await Promise.all([
    getSettings(), navCategories(), featuredCities(), footerPages(), listArticles({ breaking: true }, 10),
  ]);
  const { site, markets } = settings;
  const ticker = breaking.length ? breaking : await listArticles({}, 8);
  const nav = cats.filter((c) => c.showInNav);
  const url = siteUrl();
  const cityLinks = cityList.map((c) => ({ name: c.name, href: cityHref(c) }));
  const navItems: [string, string][] = [["/", "होम"], ["/latest", "ताज़ा"], ...nav.slice(0, 4).map((c) => [`/${c.slug}`, c.name] as [string, string]), ["/my-city", "मेरा शहर"], ...nav.slice(4).map((c) => [`/${c.slug}`, c.name] as [string, string]), ["/state", "राज्य"], ["/videos", "वीडियो"], ["/photos", "फोटो"]];

  return (
    <html lang="hi" className={`${mukta.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="alternate" type="application/rss+xml" title={site.name} href="/feed.xml" />
        <JsonLd data={[
          { "@context": "https://schema.org", "@type": "NewsMediaOrganization", "@id": `${url}/#org`, name: site.name, url, logo: { "@type": "ImageObject", url: `${url}/logo-np.jpg`, width: 640, height: 296 },
            sameAs: Object.values(site.social).filter(Boolean), ...(site.contactEmail ? { email: site.contactEmail } : {}),
            ...(pages.some((p) => p.slug === "editorial-policy") ? { publishingPrinciples: `${url}/page/editorial-policy` } : {}) },
          { "@context": "https://schema.org", "@type": "WebSite", "@id": `${url}/#website`, name: site.name, url, inLanguage: "hi-IN", publisher: { "@id": `${url}/#org` },
            potentialAction: { "@type": "SearchAction", target: `${url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } },
        ]} />
      </head>
      <body>
        <a href="#main" className="skip">मुख्य सामग्री पर जाएं</a>
        <div className="util"><div className="wrap">
          <div className="l"><span>{hiLongToday()}</span>{cityLinks.length ? <CitySelect cities={cityLinks} /> : null}</div>
          <div className="r">
            {site.epaperUrl ? <a href={site.epaperUrl} target="_blank" rel="noopener">ई-पेपर</a> : null}
            {site.appUrl ? <a href={site.appUrl} target="_blank" rel="noopener">ऐप डाउनलोड</a> : null}
            <Social s={site.social} />
          </div>
        </div></div>

        <header className="brand">
          <div className="wrap">
            <button className="icon-btn m-only" data-menu aria-label="मेनू खोलें">{Icon.menu}</button>
            <Link className="logo" href="/" aria-label={`${site.name} होम`}>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-np.jpg" alt={site.name} width={640} height={296} fetchPriority="high" />
                <div className="tag">{site.tagline}</div>
              </div>
            </Link>
            <form className="search" action="/search" role="search">
              <input name="q" placeholder="खबरें खोजें…" aria-label="खबरें खोजें" />
              <button>खोजें</button>
            </form>
            <button className="icon-btn m-only" id="searchBtn" aria-label="खोज खोलें" aria-expanded="false">{Icon.search}</button>
            {site.liveTvUrl ? (
              <a className="btn-live" href={site.liveTvUrl} target="_blank" rel="noopener"><span className="dot" />LIVE<span className="d-only">&nbsp;TV</span></a>
            ) : (
              <Link className="btn-live" href="/videos"><span className="dot" />LIVE<span className="d-only">&nbsp;TV</span></Link>
            )}
            <button className="icon-btn d-only" data-act="theme" aria-label="थीम बदलें">◐</button>
          </div>
          <form className="msearch" id="msearch" action="/search" role="search" hidden>
            <div className="wrap"><input name="q" placeholder="खबरें खोजें, जैसे मेट्रो, सेंसेक्स…" aria-label="खबरें खोजें" /><button>खोजें</button></div>
          </form>
        </header>

        <nav className="cats" aria-label="श्रेणियां"><div className="wrap" id="nav">
          {navItems.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}
        </div></nav>

        {ticker.length ? (
          <div className="ticker"><div className="wrap">
            <Link className="lab" href="/latest">ब्रेकिंग</Link>
            <div className="marq"><div className="in">
              {[...ticker, ...ticker].map((n, i) => <Link key={i} href={articleHref(n)} tabIndex={i >= ticker.length ? -1 : undefined}>{n.title}</Link>)}
            </div></div>
          </div></div>
        ) : null}

        {markets.enabled && markets.items.length ? (
          <div className="wrap"><div className="mkt">
            {markets.items.map((m) => (
              <div key={m.label}>{m.label} <b>{m.value}</b> <span className={m.up ? "up" : "down"}>{m.up ? "▲" : "▼"} {m.change} ({m.pct})</span></div>
            ))}
          </div></div>
        ) : null}

        <main className="wrap" id="main">{children}</main>

        <footer>
          <div className="wrap">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-np.jpg" alt={site.name} width={640} height={296} loading="lazy" style={{ width: 180, height: "auto", borderRadius: 8, background: "#fff", padding: 6 }} />
              <p>{site.description}</p>
              {site.address || site.phone || site.contactEmail ? (
                <p style={{ fontSize: 13 }}>{[site.address, site.phone, site.contactEmail].filter(Boolean).join(" · ")}</p>
              ) : null}
              <Social s={site.social} />
            </div>
            <div><h4>श्रेणियां</h4><ul>{nav.slice(0, 7).map((c) => <li key={c.slug}><Link href={`/${c.slug}`}>{c.name}</Link></li>)}</ul></div>
            <div><h4>शहर</h4><ul>{cityLinks.slice(0, 7).map((c) => <li key={c.href}><Link href={c.href}>{c.name}</Link></li>)}<li><Link href="/state">सभी राज्य ›</Link></li></ul></div>
            <div><h4>हमारे बारे में</h4><ul>{pages.map((p) => <li key={p.slug}><Link href={`/page/${p.slug}`}>{p.title}</Link></li>)}</ul></div>
          </div>
          <div className="copy">© {new Date().getFullYear()} {site.name}. सर्वाधिकार सुरक्षित।{site.footerNote ? ` · ${site.footerNote}` : ""}</div>
        </footer>

        <div className="drawer-bg" id="drawerBg" hidden />
        <aside className="drawer" id="drawer" aria-label="मेनू" aria-hidden="true" inert>
          <div className="dhead">
            <div className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-np.jpg" alt={site.name} width={640} height={296} loading="lazy" style={{ height: 44, width: "auto" }} />
            </div>
            <button className="icon-btn" data-close-drawer aria-label="मेनू बंद करें">✕</button>
          </div>
          <div className="ddate">{hiLongToday()}</div>
          <div className="dsec"><h5>श्रेणियां</h5><div className="dcats" id="dcats">
            {navItems.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}
          </div></div>
          {cityLinks.length ? (
            <div className="dsec"><h5>मेरा शहर</h5><div className="tabs" style={{ flexWrap: "wrap" }}>
              {cityLinks.map((c) => <Link key={c.href} href={c.href}>{c.name}</Link>)}
            </div></div>
          ) : null}
          <div className="dsec"><h5>और भी</h5><div className="dlinks">
            {site.epaperUrl ? <a href={site.epaperUrl} target="_blank" rel="noopener">ई-पेपर</a> : null}
            {site.appUrl ? <a href={site.appUrl} target="_blank" rel="noopener">ऐप डाउनलोड</a> : null}
            {pages.slice(0, 2).map((p) => <Link key={p.slug} href={`/page/${p.slug}`}>{p.title}</Link>)}
            <button data-act="theme">◐ डार्क / लाइट मोड</button>
          </div></div>
          <div className="dsec"><Social s={site.social} /></div>
        </aside>

        <nav className="bbar" aria-label="मुख्य मेनू">
          <Link href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>होम</Link>
          <Link href="/latest"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 14h6l-1 7 8-11h-6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>ताज़ा</Link>
          <Link href="/videos"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></svg>वीडियो</Link>
          <Link href="/my-city"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="9.5" r="2.5" fill="currentColor" /></svg>मेरा शहर</Link>
          <button data-menu><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>मेनू</button>
        </nav>

        <Interactions />
      </body>
    </html>
  );
}
