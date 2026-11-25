import { getObject } from "@/lib/storage";

// Serves uploaded files from Supabase Storage. Keys contain a random id, so
// responses are immutable and cached for a year.
const COPY = ["content-type", "content-length", "content-range", "etag", "last-modified"];

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.map(decodeURIComponent).join("/");
  if (!/^[a-z]+\/\d{4}\/\d{2}\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });

  const upstream = await getObject(key, req);
  if (upstream.status === 404) return new Response("Not found", { status: 404 });
  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
    return new Response("Media unavailable", { status: 502 });
  }

  const headers = new Headers();
  for (const h of COPY) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");

  if (upstream.status === 304) return new Response(null, { status: 304, headers });
  return new Response(upstream.body, { status: upstream.status, headers });
}
