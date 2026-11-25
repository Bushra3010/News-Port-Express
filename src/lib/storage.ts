import "server-only";
import { getEnv, requireEnv } from "./db";

/**
 * Supabase Storage, over the Storage REST API rather than @supabase/supabase-js.
 *
 * The SDK's download() buffers an object into a Blob, which is wrong for the
 * video files this bucket holds; raw fetch lets /media stream the body and pass
 * Range requests straight through. It also keeps the Worker bundle small.
 *
 * The bucket is private: the service role key never leaves the server and all
 * reads go through the /media route, so objects cannot be fetched directly.
 */

const CACHE_CONTROL = "public, max-age=31536000, immutable";

function base(): string {
  return requireEnv("SUPABASE_URL").replace(/\/+$/, "");
}

function bucket(): string {
  return getEnv().SUPABASE_MEDIA_BUCKET || "media";
}

function authHeaders(): Record<string, string> {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { Authorization: `Bearer ${key}`, apikey: key };
}

function objectUrl(key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${base()}/storage/v1/object/${bucket()}/${path}`;
}

/** Uploads a new object. Keys are never reused, so upsert stays off. */
export async function putObject(key: string, body: BodyInit, contentType: string): Promise<void> {
  const res = await fetch(objectUrl(key), {
    method: "POST",
    headers: {
      ...authHeaders(),
      "content-type": contentType,
      "cache-control": CACHE_CONTROL,
      "x-upsert": "false",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Fetches an object, forwarding conditional and range headers so the caller can
 * relay 206 and 304 responses without buffering anything.
 */
export async function getObject(key: string, req: Request): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders() };
  const range = req.headers.get("range");
  if (range) headers.range = range;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch) headers["if-none-match"] = ifNoneMatch;
  return fetch(objectUrl(key), { headers });
}

export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(objectUrl(key), { method: "DELETE", headers: authHeaders() });
  // A missing object is fine: the database row is going away regardless.
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Storage delete failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}
