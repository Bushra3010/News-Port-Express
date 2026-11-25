import { siteUrl } from "@/lib/db";
import { articleHref, listArticles } from "@/lib/news";
import { getSettings } from "@/lib/settings";
import { encPath, xml, xmlEscape } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** RSS 2.0 feed of the latest 50 stories. */
export async function GET() {
  const base = siteUrl();
  const { site } = await getSettings();
  const items = await listArticles({}, 50);
  const body = items.map((a) => {
    const link = `${base}${encPath(articleHref(a))}`;
    return `<item><title>${xmlEscape(a.title)}</title><link>${xmlEscape(link)}</link><guid isPermaLink="true">${xmlEscape(link)}</guid>` +
      `<pubDate>${new Date(a.publishedAt!).toUTCString()}</pubDate>${a.categoryName ? `<category>${xmlEscape(a.categoryName)}</category>` : ""}` +
      `${a.summary ? `<description>${xmlEscape(a.summary)}</description>` : ""}` +
      `${a.imageKey ? `<enclosure url="${base}/media/${a.imageKey}" type="image/${a.imageKey.split(".").pop() === "jpg" ? "jpeg" : a.imageKey.split(".").pop()}" length="0"/>` : ""}</item>`;
  }).join("\n");
  return xml(
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(site.name)}</title><link>${base}</link>` +
      `<description>${xmlEscape(site.description)}</description><language>hi-IN</language><atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>\n${body}\n</channel></rss>`,
    300,
  );
}
