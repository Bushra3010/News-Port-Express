import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ListingBody, MiniCard, SectionHead, Thumb } from "@/components/site/cards";
import JsonLd from "@/components/site/JsonLd";
import { ShareButtons, ViewBeacon } from "@/components/site/Widgets";
import { countArticles, getArticleBySlug, getCategoryBySlug, listArticles, mediaUrl, related, trending, type FullArticle } from "@/lib/news";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/permissions";
import { siteUrl } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { hiDateTime, readingMinutes, stripHtml, videoEmbedUrl } from "@/lib/util";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
const PER = 21;

type P = { params: Promise<{ category: string; slug: string }>; searchParams: Promise<{ page?: string; preview?: string }> };

async function resolve(p: P) {
  const { category, slug } = await p.params;
  const sp = await p.searchParams;
  const catSlug = decodeURIComponent(category);
  const s = decodeURIComponent(slug);
  // A subcategory listing, e.g. /khel/cricket
  const parent = await getCategoryBySlug(catSlug);
  if (parent && !parent.parentId) {
    const sub = parent.children.find((c) => c.slug === s);
    if (sub) return { kind: "sub" as const, parent, sub: (await getCategoryBySlug(sub.slug))!, page: pageNum(sp.page) };
  }
  let art = await getArticleBySlug(s);
  let preview = false;
  if (!art && sp.preview === "1") {
    const user = await getCurrentUser();
    const draft = await getArticleBySlug(s, { preview: true });
    if (user && draft && canView(user, draft.a)) {
      art = draft;
      preview = true;
    }
  }
  if (!art) return null;
  return { kind: "article" as const, art, catSlug, preview };
}

const canonicalPath = (art: FullArticle) => `/${art.categorySlug || "news"}/${art.a.slug}`;

export async function generateMetadata(p: P): Promise<Metadata> {
  const r = await resolve(p);
  if (!r) return {};
  if (r.kind === "sub") {
    const t = r.sub.seoTitle || `${r.sub.name} समाचार`;
    return { title: t, description: r.sub.seoDescription || r.sub.description || undefined, alternates: { canonical: `/${r.parent.slug}/${r.sub.slug}` } };
  }
  const { a } = r.art;
  const url = siteUrl();
  const title = a.seoTitle || a.title;
  const description = a.metaDescription || a.summary || stripHtml(a.content).slice(0, 160);
  const image = mediaUrl(r.art.ogKey) || mediaUrl(r.art.imageKey);
  return {
    title,
    description,
    keywords: [a.focusKeyword, ...(a.keywords?.split(",") ?? []), ...r.art.tags.map((t) => t.name)].filter(Boolean).map((k) => k!.trim()),
    alternates: { canonical: a.canonicalUrl || canonicalPath(r.art) },
    robots: r.preview ? { index: false, follow: false } : undefined,
    authors: r.art.authorName || a.byline ? [{ name: (a.byline || r.art.authorName)! }] : undefined,
    openGraph: {
      type: "article", title: a.ogTitle || title, description: a.ogDescription || description, url: canonicalPath(r.art),
      publishedTime: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(a.updatedAt).toISOString(), section: r.art.categoryName ?? undefined, tags: r.art.tags.map((t) => t.name),
      images: image ? [{ url: `${url}${image}`, width: r.art.imageW ?? undefined, height: r.art.imageH ?? undefined, alt: r.art.imageAlt ?? a.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title: a.ogTitle || title, description: a.ogDescription || description, images: image ? [`${url}${image}`] : undefined },
  };
}

export default async function Page(p: P) {
  const r = await resolve(p);
  if (!r) notFound();

  if (r.kind === "sub") {
    const { parent, sub, page } = r;
    const [cards, total] = await Promise.all([listArticles({ subcategoryId: sub.id }, PER, (page - 1) * PER), countArticles({ subcategoryId: sub.id })]);
    return (
      <>
        <section className="ph">
          <div className="crumbs"><Link href="/">होम</Link>›<Link href={`/${parent.slug}`}>{parent.name}</Link>›<span>{sub.name}</span></div>
          <div className="sec-h" style={{ marginBottom: 0 }}><h1>{sub.name}</h1></div>
          {sub.description ? <p>{sub.description}</p> : null}
          <div className="chips">{parent.children.map((s) => <Link key={s.id} href={`/${parent.slug}/${s.slug}`} className={s.id === sub.id ? "on" : ""}>{s.name}</Link>)}</div>
        </section>
        <ListingBody cards={cards} page={page} total={total} perPage={PER} base={`/${parent.slug}/${sub.slug}`} />
      </>
    );
  }

  const { art, preview } = r;
  if (!preview && r.catSlug !== (art.categorySlug || "news")) permanentRedirect(canonicalPath(art));
  const { a } = art;
  const url = siteUrl();
  const [rel, trend, { site }] = await Promise.all([related(a, 6), trending(6), getSettings()]);
  const fullUrl = `${url}${canonicalPath(art)}`;
  const hero = mediaUrl(art.imageKey);
  const embed = videoEmbedUrl(a.videoUrl);
  const videoFile = mediaUrl(art.videoKey);
  const author = a.byline || art.authorName || `${site.name} डेस्क`;
  const images = [mediaUrl(art.ogKey), hero, ...art.gallery.map((g) => mediaUrl(g.key))].filter(Boolean).map((x) => `${url}${x}`);
  const crumbs = [
    { name: "होम", href: "/" },
    ...(art.categorySlug ? [{ name: art.categoryName!, href: `/${art.categorySlug}` }] : []),
    ...(art.subSlug && art.categorySlug ? [{ name: art.subName!, href: `/${art.categorySlug}/${art.subSlug}` }] : []),
  ];

  return (
    <>
      {!preview ? (
        <JsonLd data={[
          {
            "@context": "https://schema.org", "@type": a.type === "video" ? "VideoObject" : "NewsArticle",
            ...(a.type === "video"
              ? { name: a.title, description: a.summary || a.title, thumbnailUrl: images.length ? images : [`${url}/logo-np.jpg`], uploadDate: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined, embedUrl: embed ?? undefined, contentUrl: videoFile ? `${url}${videoFile}` : undefined }
              : {
                  headline: a.title.slice(0, 110), description: a.metaDescription || a.summary || undefined,
                  image: images.length ? images : [`${url}/logo-np.jpg`],
                  datePublished: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
                  dateModified: new Date(a.updatedAt).toISOString(),
                  author: [{ "@type": "Person", name: author, ...(a.authorId && !a.byline ? { url: `${url}/author/${a.authorId}` } : {}) }],
                  publisher: { "@id": `${url}/#org` },
                  mainEntityOfPage: { "@type": "WebPage", "@id": fullUrl },
                  articleSection: art.categoryName ?? undefined, inLanguage: "hi-IN",
                  keywords: [a.focusKeyword, a.keywords, ...art.tags.map((t) => t.name)].filter(Boolean).join(", ") || undefined,
                  ...(art.cityName ? { contentLocation: { "@type": "Place", name: art.cityName } } : {}),
                }),
          },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [...crumbs, { name: a.title, href: canonicalPath(art) }].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${url}${c.href === "/" ? "" : c.href}` })) },
        ]} />
      ) : null}
      {!preview ? <ViewBeacon id={a.id} /> : null}

      <div className="article-wrap">
        <article className="article">
          {preview ? <div className="preview-bar">प्रीव्यू मोड — यह खबर अभी प्रकाशित नहीं है (स्थिति: {a.status})। यह पेज सर्च इंजन में नहीं दिखेगा।</div> : null}
          <nav className="crumbs" aria-label="ब्रेडक्रंब">
            {crumbs.map((c, i) => <span key={c.href} style={{ display: "contents" }}>{i > 0 ? "›" : null}<Link href={c.href}>{c.name}</Link></span>)}
          </nav>
          <h1>{a.title}</h1>
          {a.subtitle ? <p className="sub">{a.subtitle}</p> : null}
          <div className="byl">
            <span>लेखक: <b>{a.authorId && !a.byline ? <Link href={`/author/${a.authorId}`}>{author}</Link> : author}</b></span>
            {art.cityName || art.districtName || art.stateName ? (
              <span>{art.stateSlug ? <Link href={`/state/${art.stateSlug}${art.districtSlug ? `/${art.districtSlug}${art.citySlug ? `/${art.citySlug}` : ""}` : ""}`}>{art.cityName || art.districtName || art.stateName}</Link> : null}</span>
            ) : null}
            {a.publishedAt ? <span>प्रकाशित: <time dateTime={new Date(a.publishedAt).toISOString()}>{hiDateTime(a.publishedAt)}</time></span> : null}
            {a.publishedAt && a.updatedAt - a.publishedAt > 10 * 60_000 ? <span>अपडेट: <time dateTime={new Date(a.updatedAt).toISOString()}>{hiDateTime(a.updatedAt)}</time></span> : null}
            <span>{readingMinutes(a.content)} मिनट में पढ़ें</span>
          </div>
          <ShareButtons url={fullUrl} title={a.title} />

          {embed ? (
            <div className="video-frame"><iframe src={embed} title={a.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
          ) : videoFile ? (
            <div className="video-frame"><video src={videoFile} controls preload="metadata" poster={hero ?? undefined} /></div>
          ) : hero ? (
            <figure className="hero">
              <Thumb card={{ imageKey: art.imageKey, imageAlt: art.imageAlt, imageW: art.imageW, imageH: art.imageH, categorySlug: art.categorySlug, categoryName: art.categoryName, title: a.title, videoUrl: null }} priority />
              {art.imageTitle ? <figcaption>{art.imageTitle}</figcaption> : null}
            </figure>
          ) : null}

          {a.summary ? <p className="summary">{a.summary}</p> : null}
          <div className="body" dangerouslySetInnerHTML={{ __html: a.content }} />

          {art.gallery.length ? (
            <div className="gallery">
              {art.gallery.map((g) => (
                <figure key={g.key}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(g.key)!} alt={g.alt || g.caption || a.title} width={g.w ?? 800} height={g.h ?? 600} loading="lazy" decoding="async" />
                  {g.caption || g.title ? <figcaption>{g.caption || g.title}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null}

          {art.tags.length ? <div className="tags">{art.tags.map((t) => <Link key={t.slug} href={`/tag/${encodeURIComponent(t.slug)}`}>#{t.name}</Link>)}</div> : null}
          <ShareButtons url={fullUrl} title={a.title} />

          {rel.length ? (
            <section className="related">
              <SectionHead title="ये भी पढ़ें" />
              <div className="stack">{rel.map((c, i) => <MiniCard key={c.id} card={c} i={i} />)}</div>
            </section>
          ) : null}
        </article>

        <aside className="sticky-side">
          {trend.length ? (
            <div className="card side">
              <SectionHead title="ट्रेंडिंग" href="/trending" />
              <div className="stack">{trend.filter((t) => t.id !== a.id).slice(0, 5).map((c, i) => <MiniCard key={c.id} card={c} i={i + 4} />)}</div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
