import { sql } from "drizzle-orm";
import { getDb, siteUrl } from "@/lib/db";
import { articles } from "@/lib/schema";
import { publicWhere } from "@/lib/news";
import { iso, SITEMAP_PAGE_SIZE, xml } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Sitemap index pointing at every child sitemap. */
export async function GET() {
  const url = siteUrl();
  // float8 so postgres.js parses it as a JS number; epoch-ms is exact below 2^53.
  const r = await getDb().select({ n: sql<number>`count(*)::int`, last: sql<number>`max(${articles.updatedAt})::float8` }).from(articles).where(publicWhere()).limit(1).then((r) => r[0]);
  const pages = Math.max(1, Math.ceil((r?.n ?? 0) / SITEMAP_PAGE_SIZE));
  const last = iso(r?.last ?? Date.now());
  const maps = ["pages.xml", "categories.xml", "locations.xml", ...Array.from({ length: pages }, (_, i) => `articles-${i + 1}.xml`)];
  return xml(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      maps.map((m) => `<sitemap><loc>${url}/sitemaps/${m}</loc><lastmod>${last}</lastmod></sitemap>`).join("\n") +
      `\n<sitemap><loc>${url}/news-sitemap.xml</loc><lastmod>${last}</lastmod></sitemap>\n</sitemapindex>`,
  );
}
