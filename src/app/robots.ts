import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/search", "/*?preview="] }],
    sitemap: [`${url}/sitemap.xml`, `${url}/news-sitemap.xml`],
  };
}
