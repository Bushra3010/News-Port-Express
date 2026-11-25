import "server-only";

export const SITEMAP_PAGE_SIZE = 5000;

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Encodes each path segment (Hindi slugs) so URLs in XML are valid. */
export const encPath = (p: string) => p.split("/").map((s) => (s ? encodeURIComponent(s) : s)).join("/");

export function xml(body: string, maxAge = 600) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}` },
  });
}

export const iso = (ms: number) => new Date(ms).toISOString();
