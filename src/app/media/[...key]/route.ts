import { getEnv } from "@/lib/db";

// Serves uploaded files from R2. Keys contain a random id, so responses are cached for a year.
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.map(decodeURIComponent).join("/");
  if (!/^[a-z]+\/\d{4}\/\d{2}\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
  const bucket = getEnv().MEDIA;

  const range = parseRange(req.headers.get("range"));
  const obj = await bucket.get(key, range ? { range } : undefined);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");

  if (req.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304, headers });

  if (range && "body" in obj) {
    const start = "offset" in range ? range.offset ?? 0 : obj.size - (range as { suffix: number }).suffix;
    const len = "length" in range && range.length ? range.length : obj.size - start;
    headers.set("content-range", `bytes ${start}-${start + len - 1}/${obj.size}`);
    headers.set("content-length", String(len));
    return new Response((obj as R2ObjectBody).body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response((obj as R2ObjectBody).body, { headers });
}

function parseRange(h: string | null): R2Range | undefined {
  const m = h?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return undefined;
  if (!m[1]) return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  return m[2] ? { offset, length: Number(m[2]) - offset + 1 } : { offset };
}
