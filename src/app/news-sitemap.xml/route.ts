import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb, siteUrl } from "@/lib/db";
import { articles, categories } from "@/lib/schema";
import { publicWhere } from "@/lib/news";
import { getSettings } from "@/lib/settings";
import { encPath, iso, xml, xmlEscape } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Google News sitemap: articles published in the last 48 hours (max 1,000), per Google's guidelines. */
export async function GET() {
  const base = siteUrl();
  const { site } = await getSettings();
  const rows = await getDb()
    .select({ slug: articles.slug, title: articles.title, publishedAt: articles.publishedAt, keywords: articles.keywords, cat: categories.slug })
    .from(articles)
    .leftJoin(categories, and(eq(categories.id, articles.categoryId), isNull(categories.parentId)))
    .where(and(publicWhere(), gte(articles.publishedAt, Date.now() - 48 * 3600_000), eq(articles.type, "news")))
    .orderBy(desc(articles.publishedAt))
    .limit(1000)
    .all();
  const body = rows.map((r) => `<url><loc>${xmlEscape(`${base}/${encPath(`${r.cat ?? "news"}/${r.slug}`)}`)}</loc><news:news>` +
    `<news:publication><news:name>${xmlEscape(site.name)}</news:name><news:language>hi</news:language></news:publication>` +
    `<news:publication_date>${iso(r.publishedAt!)}</news:publication_date><news:title>${xmlEscape(r.title)}</news:title>` +
    `</news:news></url>`).join("\n");
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>`, 300);
}
