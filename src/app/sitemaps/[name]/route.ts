import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, siteUrl } from "@/lib/db";
import { articles, categories, cities, districts, media, pages, states } from "@/lib/schema";
import { publicWhere } from "@/lib/news";
import { encPath, iso, SITEMAP_PAGE_SIZE, xml, xmlEscape } from "@/lib/seo";

export const dynamic = "force-dynamic";

const urlset = (body: string, images = false) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${images ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` : ""}>\n${body}\n</urlset>`;
const u = (loc: string, lastmod?: number, extra = "") => `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${iso(lastmod)}</lastmod>` : ""}${extra}</url>`;

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  const db = getDb();
  const base = siteUrl();

  if (name === "pages.xml") {
    const rows = await db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.isPublished, true)).orderBy(asc(pages.sortOrder));
    const fixed = ["/", "/latest", "/trending", "/videos", "/photos", "/state", "/my-city"];
    return xml(urlset([...fixed.map((p) => u(`${base}${p === "/" ? "" : p}`, Date.now())), ...rows.map((p) => u(`${base}/page/${encPath(p.slug)}`, p.updatedAt))].join("\n")));
  }

  if (name === "categories.xml") {
    const parent = alias(categories, "parent");
    const rows = await db.select({ slug: categories.slug, parentSlug: parent.slug, updatedAt: categories.updatedAt })
      .from(categories).leftJoin(parent, eq(parent.id, categories.parentId)).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder));
    return xml(urlset(rows.map((c) => u(`${base}/${encPath(c.parentSlug ? `${c.parentSlug}/${c.slug}` : c.slug)}`, c.updatedAt)).join("\n")));
  }

  if (name === "locations.xml") {
    // Only locations that actually have published news, so Google is not sent to empty pages.
    const [st, ds, cs] = await Promise.all([
      db.selectDistinct({ s: states.slug }).from(states).innerJoin(articles, and(eq(articles.stateId, states.id), publicWhere())),
      db.selectDistinct({ s: states.slug, d: districts.slug }).from(districts).innerJoin(states, eq(states.id, districts.stateId)).innerJoin(articles, and(eq(articles.districtId, districts.id), publicWhere())),
      db.selectDistinct({ s: states.slug, d: districts.slug, c: cities.slug }).from(cities).innerJoin(districts, eq(districts.id, cities.districtId)).innerJoin(states, eq(states.id, districts.stateId)).innerJoin(articles, and(eq(articles.cityId, cities.id), publicWhere())),
    ]);
    return xml(urlset([
      ...st.map((r) => u(`${base}/state/${r.s}`)),
      ...ds.map((r) => u(`${base}/state/${r.s}/${r.d}`)),
      ...cs.map((r) => u(`${base}/state/${r.s}/${r.d}/${r.c}`)),
    ].join("\n")));
  }

  const m = name.match(/^articles-(\d+)\.xml$/);
  if (m) {
    const page = Number(m[1]);
    const img = alias(media, "img");
    const rows = await db
      .select({ slug: articles.slug, updatedAt: articles.updatedAt, cat: categories.slug, key: img.storageKey, title: articles.title })
      .from(articles)
      .leftJoin(categories, and(eq(categories.id, articles.categoryId), isNull(categories.parentId)))
      .leftJoin(img, eq(img.id, articles.featuredMediaId))
      .where(and(publicWhere(), sql`${articles.canonicalUrl} IS NULL`))
      .orderBy(desc(articles.publishedAt))
      .limit(SITEMAP_PAGE_SIZE).offset((page - 1) * SITEMAP_PAGE_SIZE);
    if (!rows.length && page > 1) return new Response("Not found", { status: 404 });
    return xml(urlset(rows.map((r) => u(
      `${base}/${encPath(`${r.cat ?? "news"}/${r.slug}`)}`, r.updatedAt,
      r.key ? `<image:image><image:loc>${base}/media/${r.key}</image:loc></image:image>` : "",
    )).join("\n"), true));
  }

  return new Response("Not found", { status: 404 });
}
