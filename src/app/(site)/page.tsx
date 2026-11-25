import Link from "next/link";
import { CityTabs, Poll, Rashifal } from "@/components/site/Widgets";
import { Grid, LeadCard, MiniCard, SectionHead, StoryCard, Thumb } from "@/components/site/cards";
import { articleHref, cityHref, featuredCities, listArticles, navCategories, statesWithNews, trending, type Card } from "@/lib/news";
import { getSettings } from "@/lib/settings";
import { hhmm } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, cats, cityList, featured, latest, trend, videos, galleries, statesList] = await Promise.all([
    getSettings(), navCategories(), featuredCities(), listArticles({ featured: true }, 1), listArticles({}, 13),
    trending(8), listArticles({ type: "video" }, 4), listArticles({ type: "gallery" }, 8), statesWithNews(),
  ]);

  if (!latest.length) {
    return (
      <section style={{ padding: "60px 0", textAlign: "center" }}>
        <h1>{settings.site.name}</h1>
        <p className="empty">अभी कोई खबर प्रकाशित नहीं हुई है। एडमिन पैनल से पहली खबर प्रकाशित करें।</p>
      </section>
    );
  }

  const lead = featured[0] ?? latest[0];
  const rest = latest.filter((c) => c.id !== lead.id);
  const tops = rest.slice(0, 4);
  const side = rest.slice(4, 12);
  const shown = new Set([lead.id, ...tops.map((c) => c.id)]);

  // Latest 4 per top-level category, fetched in parallel.
  const perCat = new Map<string, Card[]>(
    await Promise.all(cats.map(async (c) => [c.slug, await listArticles({ categoryId: c.id }, 4)] as [string, Card[]])),
  );
  const catName = (slug: string) => cats.find((c) => c.slug === slug)?.name ?? slug;
  const band = (slug: string) => perCat.get(slug) ?? [];
  const special = new Set(["khel", "manoranjan", "karobar", "shiksha"]);

  const cityPanels: Record<number, React.ReactNode> = {};
  const cityData = await Promise.all(cityList.map(async (c) => ({ c, items: await listArticles({ cityId: c.id }, 3) })));
  const citiesWithNews = cityData.filter((x) => x.items.length);
  for (const { c, items } of citiesWithNews) {
    cityPanels[c.id] = <div className="grid3">{items.map((n, i) => <StoryCard key={n.id} card={n} i={i + c.id} showCity />)}</div>;
  }

  const { liveScore: ls, weather, rashifal, poll } = settings;
  const rashiOn = rashifal.enabled && rashifal.items.some((r) => r.text);
  const pollOn = poll.enabled && poll.question && poll.options.length >= 2;

  return (
    <>
      <h1 className="sr-only">{settings.site.name} – ताज़ा हिंदी खबरें</h1>
      <section className="top">
        <LeadCard card={lead} />
        <div className="stack">{tops.map((c, i) => <MiniCard key={c.id} card={c} i={i + 1} />)}</div>
        <aside className="card side">
          <SectionHead title="ताज़ा खबरें" href="/latest" />
          <ul className="latest">
            {side.map((n) => (
              <li key={n.id}><Link href={articleHref(n)} style={{ display: "contents" }}>
                <time>{n.publishedAt ? hhmm(n.publishedAt) : ""}</time><span>{n.title}</span>
              </Link></li>
            ))}
          </ul>
        </aside>
      </section>

      {trend.filter((c) => !shown.has(c.id)).length >= 2 ? (
        <section><SectionHead title="ट्रेंडिंग" href="/trending" /><Grid cards={trend.filter((c) => !shown.has(c.id)).slice(0, 4)} /></section>
      ) : null}

      {band("desh").length ? <section><SectionHead title={catName("desh")} href="/desh" /><Grid cards={band("desh")} /></section> : null}

      {citiesWithNews.length ? (
        <CityTabs cities={citiesWithNews.map(({ c }) => ({ id: c.id, name: c.name, href: cityHref(c) }))} panels={cityPanels} allHref="/my-city" />
      ) : null}

      {band("khel").length ? (
        <section className={ls.enabled ? "split" : ""}>
          <div><SectionHead title={catName("khel")} href="/khel" /><Grid cards={band("khel").slice(0, ls.enabled ? 3 : 4)} cols={ls.enabled ? 3 : 4} /></div>
          {ls.enabled ? (
            <div>
              <SectionHead title="लाइव स्कोर" />
              <div className="score">
                <div style={{ display: "flex", justifyContent: "space-between" }}><small>{ls.match}</small><span className="pill"><span className="dot" />LIVE</span></div>
                <div className="row"><span className="tm">{ls.team1}</span><span className="s">{ls.score1}</span></div><small>{ls.overs1}</small>
                <div className="row"><span className="tm">{ls.team2}</span><span className="s">{ls.score2}</span></div><small>{ls.overs2}</small>
                {ls.status ? <small style={{ color: "#ffb3b5", fontWeight: 700 }}>{ls.status}</small> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {videos.length ? (
        <section className="vband"><SectionHead title="वीडियो" href="/videos" /><Grid cards={videos} className="carousel" /></section>
      ) : null}

      {band("manoranjan").length ? (
        <section className={weather.enabled ? "split" : ""}>
          <div><SectionHead title={catName("manoranjan")} href="/manoranjan" /><Grid cards={band("manoranjan").slice(0, weather.enabled ? 3 : 4)} cols={weather.enabled ? 3 : 4} /></div>
          {weather.enabled ? (
            <div className="card side">
              <SectionHead title="आज का मौसम" />
              <div className="weather" style={{ padding: 0 }}>
                <div className="tmp">{weather.temp}</div>
                <div><b>{weather.city}</b><div style={{ color: "var(--muted)" }}>{weather.desc}</div><div style={{ color: "var(--muted)", fontSize: 13 }}>{weather.minMax}</div></div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {galleries.length ? (
        <section>
          <SectionHead title="फोटो गैलरी" href="/photos" />
          <div className="wstories">
            {galleries.map((g, i) => (
              <Link key={g.id} href={articleHref(g)} className="ws"><Thumb card={g} seed={i + 9} label="" /><p>{g.title}</p></Link>
            ))}
          </div>
        </section>
      ) : null}

      {band("karobar").length || band("shiksha").length || rashiOn || pollOn ? (
        <section className="split">
          <div>
            {band("karobar").length ? <><SectionHead title={catName("karobar")} href="/karobar" /><Grid cards={band("karobar").slice(0, 3)} cols={3} /></> : null}
            {band("shiksha").length ? <div style={{ marginTop: 24 }}><SectionHead title={catName("shiksha")} href="/shiksha" /><Grid cards={band("shiksha").slice(0, 3)} cols={3} /></div> : null}
          </div>
          <div className="stack">
            {rashiOn ? <Rashifal items={rashifal.items} /> : null}
            {pollOn ? <Poll id={poll.id} question={poll.question} options={poll.options} /> : null}
          </div>
        </section>
      ) : null}

      {statesList.some((s) => s.n > 0) ? (
        <section>
          <SectionHead title="राज्यों से खबरें" href="/state" />
          <div className="chips" style={{ marginTop: 0 }}>
            {statesList.filter((s) => s.n > 0).map((s) => <Link key={s.id} href={`/state/${s.slug}`}>{s.name} <small style={{ color: "var(--muted)" }}>({s.n})</small></Link>)}
          </div>
        </section>
      ) : null}

      {cats.filter((c) => !special.has(c.slug) && c.slug !== "desh" && band(c.slug).length).map((c) => (
        <section key={c.slug}><SectionHead title={c.name} href={`/${c.slug}`} /><Grid cards={band(c.slug)} /></section>
      ))}
    </>
  );
}
