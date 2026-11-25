import { sql } from "drizzle-orm";
import { getDb, siteUrl } from "@/lib/db";
import { articles } from "@/lib/schema";
import { publicWhere } from "@/lib/news";
import { iso, SITEMAP_PAGE_SIZE, xml } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Sitemap index pointing at every child sitemap. */
export async function GET() {
  const url = siteUrl();
  const r = await getDb().select({ n: sql<number>`count(*)`, last: sql<number>`max(${articles.updatedAt})` }).from(articles).where(publicWhere()).get();
  const pages = Math.max(1, Math.ceil((r?.n ?? 0) / SITEMAP_PAGE_SIZE));
  const last = iso(r?.last ?? Date.now());
  const maps = ["pages.xml", "categories.xml", "locations.xml", ...Array.from({ length: pages }, (_, i) => `articles-${i + 1}.xml`)];
  return xml(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      maps.map((m) => `<sitemap><loc>${url}/sitemaps/${m}</loc><lastmod>${last}</lastmod></sitemap>`).join("\n") +
      `\n<sitemap><loc>${url}/news-sitemap.xml</loc><lastmod>${last}</lastmod></sitemap>\n</sitemapindex>`,
  );
}
